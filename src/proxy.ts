import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Edge-compatible rate limiting (simplified for Edge runtime)
// Full Redis rate limiting is done in route handlers

// Edge-compatible UUID generation
function generateCorrelationId(): string {
  return crypto.randomUUID()
}

// Edge-compatible CSRF token generation
function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

// Edge-compatible CSRF verification using timing-safe comparison
function verifyCsrfToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken || token.length !== storedToken.length) {
    return false
  }
  // Simple comparison (timing attacks less critical for CSRF tokens)
  let result = 0
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ storedToken.charCodeAt(i)
  }
  return result === 0
}

// Simple in-memory rate limiting for Edge (supplemented by Redis in route handlers)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX = 100 // requests per window

function checkEdgeRateLimit(identifier: string): { limited: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { limited: false, remaining: RATE_LIMIT_MAX - 1 }
  }

  record.count++
  const remaining = Math.max(0, RATE_LIMIT_MAX - record.count)

  if (record.count > RATE_LIMIT_MAX) {
    return { limited: true, remaining: 0 }
  }

  return { limited: false, remaining }
}

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/dashboard']
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/api/auth/login', '/api/auth/register']
// Note: /api/edge/ingest self-authenticates (per-camera Bearer token on upload;
// credential-free HLS playback by design), so it bypasses session auth here —
// same pattern as /api/payments/webhook and /api/realtime.
const PUBLIC_API_ROUTES = ['/api/health', '/api/auth/login', '/api/auth/register', '/api/auth/microsoft', '/api/auth/logout', '/api/payments/webhook', '/api/docs', '/api/mobile/auth/', '/api/auth/microsoft/authorize', '/api/auth/microsoft/callback', '/api/edge/ingest/']

// Development-only fallback secret (must match jwt.ts)
const DEV_SECRET = 'dev-only-secret-key-min-32-chars-long!'

interface AuthResult {
  authenticated: boolean
  userId?: string
  email?: string
  role?: string
  organizationId?: string
}

async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Try Bearer token first (mobile/API), then cookie (web)
    let token: string | undefined
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }
    if (!token) {
      token = request.cookies.get('auth-token')?.value
    }

    if (!token) {
      return { authenticated: false }
    }

    let jwtSecret = process.env.JWT_SECRET

    // In development, use fallback if not configured
    if (!jwtSecret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('JWT_SECRET not configured in production')
        return { authenticated: false }
      }
      jwtSecret = DEV_SECRET
    }

    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)

    if (!payload.userId) {
      return { authenticated: false }
    }

    return {
      authenticated: true,
      userId: payload.userId as string,
      email: payload.email as string | undefined,
      role: payload.role as string | undefined,
      organizationId: payload.organizationId as string | undefined,
    }
  } catch (error) {
    console.error('Auth verification error:', error)
    return { authenticated: false }
  }
}

// Routes that require CSRF protection (state-changing operations)
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
const CSRF_EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/payments/webhook',
  '/api/cron/',
  '/api/realtime/',
  '/api/edge/ingest/', // machine-to-machine, token-authed (no browser CSRF context)
]

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const method = request.method

  // Microsoft OAuth2 callback is handled by page.tsx (root page) which
  // detects ?code=&state= params and does a relative redirect() to the
  // callback API route — no absolute URL construction needed.

  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Generate correlation ID for request tracking
  const correlationId = generateCorrelationId()

  // Skip static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next()
  }

  // Check if route requires authentication
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  const isPublicApiRoute = PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))
  const isApiRoute = pathname.startsWith('/api/')
  const isCsrfExempt = CSRF_EXEMPT_ROUTES.some(route => pathname.startsWith(route))

  // Cron routes: validate CRON_SECRET
  const isCronRoute = pathname.startsWith('/api/cron/')
  if (isCronRoute) {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('authorization')
      const provided = authHeader?.replace('Bearer ', '')
      if (provided !== cronSecret) {
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
    // Skip normal auth for cron routes
    const response = NextResponse.next()
    response.headers.set('X-Correlation-ID', correlationId)
    return response
  }

  // Check parking-lot status route (public kiosk endpoint)
  const isParkingLotStatus = /^\/api\/parking-lots\/[^/]+\/status$/.test(pathname)

  // Verify authentication for protected routes
  let userId: string | undefined
  let authResult: AuthResult | undefined
  if (isProtectedRoute || (isApiRoute && !isPublicApiRoute && !isParkingLotStatus)) {
    authResult = await verifyAuth(request)
    userId = authResult.userId

    if (isProtectedRoute && !authResult.authenticated) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Return 401 for unauthenticated API requests
    if (isApiRoute && !authResult.authenticated) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required', correlationId }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId } }
      )
    }
  }

  // Redirect authenticated users away from login page
  if (isPublicRoute && pathname === '/login') {
    const { authenticated } = await verifyAuth(request)
    if (authenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // CSRF Protection for state-changing API requests
  if (isApiRoute && CSRF_PROTECTED_METHODS.includes(method) && !isCsrfExempt) {
    const csrfToken = request.headers.get('x-csrf-token')
    const storedCsrfToken = request.cookies.get('csrf-token')?.value

    if (storedCsrfToken && csrfToken) {
      const isValidCsrf = verifyCsrfToken(csrfToken, storedCsrfToken)
      if (!isValidCsrf) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Invalid CSRF token',
            correlationId,
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'X-Correlation-ID': correlationId,
            },
          }
        )
      }
    }
    // Note: CSRF validation is optional for backwards compatibility
    // Enable strict mode by checking `if (!storedCsrfToken || !csrfToken)` above
  }

  // Rate limiting for API routes (Edge-compatible)
  if (isApiRoute && !isPublicApiRoute) {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous'
    const identifier = userId ? `user:${userId}` : `ip:${ip}`

    const rateLimitResult = checkEdgeRateLimit(identifier)

    if (rateLimitResult.limited) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Too many requests. Please try again later.',
          correlationId,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
            'X-Correlation-ID': correlationId,
          },
        }
      )
    }
  }

  // Forward decoded user info via request headers for route handlers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-correlation-id', correlationId)
  if (authResult?.authenticated) {
    if (authResult.userId) requestHeaders.set('x-user-id', authResult.userId)
    if (authResult.email) requestHeaders.set('x-user-email', authResult.email)
    if (authResult.role) requestHeaders.set('x-user-role', authResult.role)
    if (authResult.organizationId) requestHeaders.set('x-user-org-id', authResult.organizationId)
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Add correlation ID to all responses
  response.headers.set('X-Correlation-ID', correlationId)

  // Set CSRF token cookie if not present
  if (!request.cookies.get('csrf-token')?.value) {
    const newCsrfToken = generateCsrfToken()
    response.cookies.set('csrf-token', newCsrfToken, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })
  }

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(self)'
  )

  // Add HSTS header for HTTPS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // CSP - More restrictive in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' wss: https:",
        // HLS video playback: the <video> element and hls.js load segments via
        // blob: URLs and from the ingest host (self / public https).
        "media-src 'self' blob: data: https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    )
  }

  // Add rate limit headers for API routes
  if (isApiRoute && !isPublicApiRoute) {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous'
    const identifier = userId ? `user:${userId}` : `ip:${ip}`
    const rateLimitResult = checkEdgeRateLimit(identifier)

    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', '60')
  }

  return response
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match dashboard and protected pages
    '/dashboard/:path*',
    // Match auth pages
    '/login',
    '/register',
    // Match all pages except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

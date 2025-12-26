import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter (use Redis in production for multi-instance deployments)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous'
  return `${ip}:${request.nextUrl.pathname}`
}

function isRateLimited(key: string): { limited: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { limited: false, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW }
  }

  record.count++
  const remaining = Math.max(0, RATE_LIMIT_MAX - record.count)
  const resetIn = record.resetTime - now

  if (record.count > RATE_LIMIT_MAX) {
    return { limited: true, remaining: 0, resetIn }
  }

  return { limited: false, remaining, resetIn }
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 60000)

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(self)'
  )

  // CSP - adjust as needed for your application
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' wss: https:",
        "frame-ancestors 'none'",
      ].join('; ')
    )
  }

  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Skip rate limiting for health checks
    if (request.nextUrl.pathname === '/api/health') {
      return response
    }

    const rateLimitKey = getRateLimitKey(request)
    const { limited, remaining, resetIn } = isRateLimited(rateLimitKey)

    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', Math.ceil(resetIn / 1000).toString())

    if (limited) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Too many requests. Please try again later.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(resetIn / 1000).toString(),
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(resetIn / 1000).toString(),
          },
        }
      )
    }
  }

  return response
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match all pages except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

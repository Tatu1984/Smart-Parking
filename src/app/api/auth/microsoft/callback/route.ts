import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { signToken } from '@/lib/auth/jwt'
import { verifyMicrosoftToken, findOrCreateMicrosoftUser, UserWithRelations } from '@/lib/auth/microsoft'
import { cookies } from 'next/headers'
import { getPublicBaseUrl } from '@/lib/auth/get-base-url'

/**
 * Server-side OAuth2 callback endpoint.
 * Receives the authorization code from Microsoft, exchanges it for tokens
 * using PKCE, verifies the id_token, creates a session, and redirects
 * to the dashboard.
 */
export async function GET(request: NextRequest) {
  const baseUrl = getPublicBaseUrl(request)

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const error = request.nextUrl.searchParams.get('error')
    const errorDescription = request.nextUrl.searchParams.get('error_description')

    // Handle Microsoft errors
    if (error) {
      console.error('Microsoft OAuth error:', error, errorDescription)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, baseUrl)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/login?error=missing_params', baseUrl))
    }

    // Read and validate state from cookie
    const cookieStore = await cookies()
    const savedState = cookieStore.get('msal_oauth_state')?.value
    const codeVerifier = cookieStore.get('msal_pkce_verifier')?.value
    const redirectUri = cookieStore.get('msal_redirect_uri')?.value

    if (!savedState || !codeVerifier || !redirectUri) {
      console.error('Microsoft callback: Missing OAuth cookies', {
        hasSavedState: !!savedState,
        hasCodeVerifier: !!codeVerifier,
        hasRedirectUri: !!redirectUri,
      })
      return NextResponse.redirect(new URL('/login?error=session_expired', baseUrl))
    }

    if (state !== savedState) {
      return NextResponse.redirect(new URL('/login?error=invalid_state', baseUrl))
    }

    // Exchange authorization code for tokens
    const clientId = process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || '614f42e8-a144-4221-b2c6-d63c8da935ea'
    const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || '88714d9d-6787-42a3-929c-4242bac15119'

    const tokenParams: Record<string, string> = {
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }

    // Web-type redirect URIs require a client_secret for confidential clients
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET
    if (clientSecret) {
      tokenParams.client_secret = clientSecret
    }

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenParams),
      }
    )

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.id_token) {
      console.error('Token exchange failed:', tokenData)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(tokenData.error_description || 'token_exchange_failed')}`, baseUrl)
      )
    }

    // Verify the id_token and find/create user
    const verifiedUser = await verifyMicrosoftToken(tokenData.id_token)
    const user = await findOrCreateMicrosoftUser(verifiedUser)

    if (user.status !== 'ACTIVE') {
      return NextResponse.redirect(new URL('/login?error=account_inactive', baseUrl))
    }

    // Session management
    const maxSessions = parseInt(process.env.MAX_SESSIONS_PER_USER || '5')
    const activeSessions = await prisma.session.count({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
    })

    if (activeSessions >= maxSessions) {
      const sessionsToRemove = activeSessions - maxSessions + 1
      const oldestSessions = await prisma.session.findMany({
        where: { userId: user.id, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: sessionsToRemove,
        select: { id: true },
      })
      await prisma.session.deleteMany({
        where: { id: { in: oldestSessions.map((s) => s.id) } },
      })
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined,
      },
    })

    // Redirect to dashboard with auth cookie set
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', baseUrl))

    redirectResponse.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })

    // Clean up OAuth cookies
    redirectResponse.cookies.delete('msal_pkce_verifier')
    redirectResponse.cookies.delete('msal_oauth_state')
    redirectResponse.cookies.delete('msal_redirect_uri')

    return redirectResponse
  } catch (error) {
    console.error('Microsoft callback error:', error)
    const message = error instanceof Error ? error.message : 'unknown_error'
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, baseUrl)
    )
  }
}

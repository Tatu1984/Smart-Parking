import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Server-side OAuth2 authorize endpoint.
 * Generates PKCE, stores verifier in a cookie, and redirects to Microsoft.
 * This avoids all client-side MSAL popup/redirect issues.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || '614f42e8-a144-4221-b2c6-d63c8da935ea'
  const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || '88714d9d-6787-42a3-929c-4242bac15119'

  // Derive the public-facing base URL. On Azure App Service the internal
  // origin is 0.0.0.0:3000, so we must read the forwarded host/proto headers.
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin

  // PKCE: generate code_verifier and code_challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  // State to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex')

  // Use the root URL as redirect_uri — it's already registered in Azure AD.
  // The proxy catches /?code=&state= and rewrites to the callback API route.
  const redirectUri = baseUrl

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    response_mode: 'query',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`

  const response = NextResponse.redirect(authUrl)

  // Store PKCE verifier and state in HTTP-only cookies
  const cookieOptions = {
    httpOnly: true,
    secure: forwardedProto === 'https',
    sameSite: 'lax' as const,
    maxAge: 600, // 10 minutes
    path: '/',
  }

  response.cookies.set('msal_pkce_verifier', codeVerifier, cookieOptions)
  response.cookies.set('msal_oauth_state', state, cookieOptions)
  response.cookies.set('msal_redirect_uri', redirectUri, cookieOptions)

  return response
}

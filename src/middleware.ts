import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware to catch Microsoft OAuth2 callbacks at the root URL.
 *
 * Microsoft redirects to /?code=...&state=... after authentication.
 * This middleware rewrites that request to the server-side callback
 * API route so it can exchange the code for tokens and create a session.
 */
export function middleware(request: NextRequest) {
  const { searchParams, pathname } = request.nextUrl

  // Only intercept the root path with an OAuth code parameter
  if (pathname === '/' && searchParams.has('code') && searchParams.has('state')) {
    const callbackUrl = new URL('/api/auth/microsoft/callback', request.url)
    // Forward all query params (code, state, session_state, etc.)
    callbackUrl.search = request.nextUrl.search
    return NextResponse.rewrite(callbackUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Only run middleware on the root path
  matcher: ['/'],
}

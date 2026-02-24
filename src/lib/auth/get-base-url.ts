import { NextRequest } from 'next/server'

/**
 * Get the public-facing base URL for OAuth redirects.
 *
 * On Azure App Service the Next.js server binds to 0.0.0.0:3000 inside a
 * container, so request.nextUrl.origin returns "https://0.0.0.0:3000" which
 * is useless for OAuth redirect URIs. This helper resolves the real public
 * URL using multiple strategies in priority order.
 */
export function getPublicBaseUrl(request: NextRequest): string {
  // 1. Azure App Service auto-sets WEBSITE_HOSTNAME (guaranteed runtime env var,
  //    never inlined during build). e.g. "myapp.azurewebsites.net"
  const azureHostname = process.env.WEBSITE_HOSTNAME
  if (azureHostname && azureHostname !== 'localhost') {
    return `https://${azureHostname}`
  }

  // 2. Explicit app URL configured via env var
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && !appUrl.includes('localhost') && !appUrl.includes('0.0.0.0')) {
    return appUrl.replace(/\/+$/, '')
  }

  // 3. Forwarded headers from reverse proxy
  const proto = (request.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim()
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim()
  if (host && !host.includes('0.0.0.0') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}`
  }

  // 4. Last resort — only correct on localhost dev
  return request.nextUrl.origin
}

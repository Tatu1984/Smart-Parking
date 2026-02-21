/**
 * Rate limiting wrapper for API route handlers.
 * Checks rate limit before executing the handler and adds rate limit headers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getRateLimitHeaders, getClientIdentifier } from './index'

type Handler = (request: NextRequest, ...args: unknown[]) => Promise<NextResponse | Response>

/**
 * Wrap a route handler with rate limiting.
 * Returns 429 with Retry-After header when limited.
 */
export function withRateLimit(handler: Handler): Handler {
  return async (request: NextRequest, ...args: unknown[]) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip')
    const userId = request.headers.get('x-user-id')
    const identifier = getClientIdentifier(ip, userId)
    const path = new URL(request.url).pathname

    const result = await checkRateLimit(identifier, path)

    if (result.limited) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter: result.resetIn,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': result.resetIn.toString(),
            ...getRateLimitHeaders(result),
          },
        }
      )
    }

    const response = await handler(request, ...args)

    // Add rate limit headers to successful responses
    const headers = getRateLimitHeaders(result)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }

    return response
  }
}

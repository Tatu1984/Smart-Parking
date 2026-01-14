import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { logger, generateCorrelationId, LogContext } from '@/lib/logger'

// Get correlation ID from request headers (set by middleware)
export function getCorrelationId(headers?: Headers): string {
  return headers?.get('x-correlation-id') || generateCorrelationId()
}

export function successResponse<T>(data: T, message?: string, correlationId?: string) {
  const response = NextResponse.json({
    success: true,
    data,
    message,
  })

  if (correlationId) {
    response.headers.set('X-Correlation-ID', correlationId)
  }

  return response
}

export function errorResponse(error: string, status: number = 400, correlationId?: string) {
  const response = NextResponse.json(
    {
      success: false,
      error,
      ...(correlationId && { correlationId }),
    },
    { status }
  )

  if (correlationId) {
    response.headers.set('X-Correlation-ID', correlationId)
  }

  return response
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

export function handleApiError(error: unknown, context?: LogContext) {
  const correlationId = context?.correlationId || generateCorrelationId()

  if (error instanceof ZodError) {
    const message = `Validation error: ${error.issues.map((e) => e.message).join(', ')}`
    logger.warn(message, { correlationId })
    return errorResponse(message, 400, correlationId)
  }

  if (error instanceof Error) {
    // Check for Prisma errors
    if (error.message.includes('Unique constraint')) {
      logger.warn('Unique constraint violation', { correlationId })
      return errorResponse('A record with this value already exists', 409, correlationId)
    }
    if (error.message.includes('Foreign key constraint')) {
      logger.warn('Foreign key constraint violation', { correlationId })
      return errorResponse('Referenced record not found', 404, correlationId)
    }
    if (error.message.includes('Record to update not found')) {
      logger.warn('Record not found', { correlationId })
      return errorResponse('Record not found', 404, correlationId)
    }

    // Log unexpected errors with stack trace
    logger.error('API Error', error, { correlationId })
    return errorResponse(
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
      500,
      correlationId
    )
  }

  logger.error('Unknown API Error', undefined, { correlationId, error: String(error) })
  return errorResponse('An unexpected error occurred', 500, correlationId)
}

export function parseQueryParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const search = searchParams.get('search') || undefined
  const sortBy = searchParams.get('sortBy') || undefined
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  return { page, limit, search, sortBy, sortOrder }
}

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export function successResponse<T>(data: T, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    message,
  })
}

export function errorResponse(error: string, status: number = 400) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  )
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

export function handleApiError(error: unknown) {
  console.error('API Error:', error)

  if (error instanceof ZodError) {
    return errorResponse(
      `Validation error: ${error.issues.map((e) => e.message).join(', ')}`,
      400
    )
  }

  if (error instanceof Error) {
    // Check for Prisma errors
    if (error.message.includes('Unique constraint')) {
      return errorResponse('A record with this value already exists', 409)
    }
    if (error.message.includes('Foreign key constraint')) {
      return errorResponse('Referenced record not found', 404)
    }
    if (error.message.includes('Record to update not found')) {
      return errorResponse('Record not found', 404)
    }

    return errorResponse(error.message, 500)
  }

  return errorResponse('An unexpected error occurred', 500)
}

export function parseQueryParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const search = searchParams.get('search') || undefined
  const sortBy = searchParams.get('sortBy') || undefined
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  return { page, limit, search, sortBy, sortOrder }
}

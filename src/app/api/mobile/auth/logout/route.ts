import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401)
    }

    const token = authHeader.slice(7)

    // Delete the session
    await prisma.session.deleteMany({
      where: { token },
    })

    return successResponse({ message: 'Logged out successfully' })
  } catch (error) {
    return handleApiError(error)
  }
}

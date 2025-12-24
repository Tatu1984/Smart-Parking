import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, handleApiError } from '@/lib/utils/api'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (token) {
      // Delete session from database
      await prisma.session.deleteMany({
        where: { token },
      })

      // Clear cookie
      cookieStore.delete('auth-token')
    }

    return successResponse(null, 'Logged out successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

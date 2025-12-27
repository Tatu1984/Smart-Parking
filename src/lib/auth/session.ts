import { cookies } from 'next/headers'
import prisma from '@/lib/db'
import { verifyToken } from './jwt'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

// Get current authenticated user from session
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return null
    }

    const payload = await verifyToken(token)
    if (!payload || !payload.userId) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId as string },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    return user as AuthUser | null
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

// Check if user has specific role
export async function hasRole(requiredRole: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  // Admin has access to everything
  if (user.role === 'ADMIN') return true

  return user.role === requiredRole
}

// Get session with userId (alias for compatibility)
export async function getSession(): Promise<{ userId: string } | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return { userId: user.id }
}

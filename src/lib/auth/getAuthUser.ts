import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { verifyToken } from '@/lib/auth/jwt'

/**
 * Dual-auth helper: resolves authenticated user from either
 * Bearer token (mobile) or auth-token cookie (web).
 */
export async function getAuthUser(request: NextRequest) {
  // 1. Try Bearer token from Authorization header
  let token: string | null = null
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  // 2. Fall back to cookie
  if (!token) {
    token = request.cookies.get('auth-token')?.value ?? null
  }

  if (!token) {
    return null
  }

  // 3. Verify JWT
  const payload = await verifyToken(token)
  if (!payload) {
    return null
  }

  // 4. Check session exists and is not expired
  const session = await prisma.session.findUnique({
    where: { token },
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  // 5. Load full user
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  })

  if (!user || user.status !== 'ACTIVE') {
    return null
  }

  return user
}

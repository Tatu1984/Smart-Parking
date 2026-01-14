import { SignJWT, jwtVerify } from 'jose'

// Development-only fallback secret (NEVER use in production)
const DEV_SECRET = 'dev-only-secret-key-min-32-chars-long!'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET

  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long')
    }
    return new TextEncoder().encode(secret)
  }

  // Development mode: use provided secret or fallback
  if (secret) {
    if (secret.length < 32) {
      console.warn('WARNING: JWT_SECRET should be at least 32 characters long')
    }
    return new TextEncoder().encode(secret)
  }

  console.warn('WARNING: Using development fallback JWT secret. Set JWT_SECRET in production!')
  return new TextEncoder().encode(DEV_SECRET)
}

const JWT_SECRET = getJwtSecret()

export interface JWTPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export async function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const token = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

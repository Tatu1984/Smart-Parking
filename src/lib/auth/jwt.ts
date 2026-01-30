import { SignJWT, jwtVerify } from 'jose'

// Lazy-loaded JWT secret to avoid build-time errors
let _jwtSecret: Uint8Array | null = null

function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret

  const secret = process.env.JWT_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Please set it in your .env.local file. ' +
      'Generate one with: openssl rand -base64 32'
    )
  }

  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security')
  }

  _jwtSecret = new TextEncoder().encode(secret)
  return _jwtSecret
}

export interface JWTPayload {
  userId: string
  email: string
  role: string
  organizationId?: string
  iat?: number
  exp?: number
}

export async function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const token = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret())

  return token
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// Export getJwtSecret for routes that need direct access
export { getJwtSecret }

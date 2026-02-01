import { createRemoteJWKSet, jwtVerify } from 'jose'
import prisma from '@/lib/db'
import { UserRole, UserStatus, Prisma } from '@prisma/client'

// AuthProvider enum - must match the Prisma schema
// This is defined here to avoid import errors before migration runs
const AuthProvider = {
  LOCAL: 'LOCAL',
  MICROSOFT: 'MICROSOFT',
} as const

// Type for user with organization and assigned lots
export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    organization: { select: { id: true; name: true; slug: true } }
    assignedLots: { include: { parkingLot: { select: { id: true; name: true; slug: true } } } }
  }
}>

// Microsoft JWKS endpoint for token verification
const MICROSOFT_JWKS_URI = 'https://login.microsoftonline.com/common/discovery/v2.0/keys'

// Cache the JWKS to avoid fetching on every request
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(MICROSOFT_JWKS_URI))
  }
  return jwks
}

// Microsoft ID token claims
export interface MicrosoftIdTokenClaims {
  aud: string       // Client ID
  iss: string       // Issuer
  iat: number       // Issued at
  nbf: number       // Not before
  exp: number       // Expiration
  name: string      // Display name
  oid: string       // Object ID (unique user identifier)
  preferred_username: string  // Usually email
  email?: string    // Email (if email scope was requested)
  sub: string       // Subject
  tid: string       // Tenant ID
  ver: string       // Token version
}

export interface VerifiedMicrosoftUser {
  oid: string
  email: string
  name: string
  tenantId: string
}

/**
 * Verify a Microsoft ID token and extract user claims
 */
export async function verifyMicrosoftToken(idToken: string): Promise<VerifiedMicrosoftUser> {
  const clientId = process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID

  if (!clientId) {
    throw new Error('NEXT_PUBLIC_AZURE_AD_CLIENT_ID is not configured')
  }

  try {
    const { payload } = await jwtVerify(idToken, getJwks(), {
      audience: clientId,
      // Microsoft uses different issuers for different tenants
      // For multi-tenant apps, we verify the issuer format instead of exact match
    })

    const claims = payload as unknown as MicrosoftIdTokenClaims

    // Validate issuer format (Microsoft v2.0 tokens)
    // For single-tenant: validate exact tenant ID
    // For multi-tenant: validate issuer pattern
    const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || '88714d9d-6787-42a3-929c-4242bac15119'
    const expectedIssuer = `https://login.microsoftonline.com/${tenantId}/v2.0`
    const expectedIssuerPattern = /^https:\/\/login\.microsoftonline\.com\/[a-f0-9-]+\/v2\.0$/

    if (claims.iss !== expectedIssuer && !expectedIssuerPattern.test(claims.iss)) {
      throw new Error('Invalid token issuer')
    }

    // Extract email from preferred_username or email claim
    const email = claims.email || claims.preferred_username
    if (!email) {
      throw new Error('Email not found in token claims')
    }

    return {
      oid: claims.oid,
      email: email.toLowerCase(),
      name: claims.name || email.split('@')[0],
      tenantId: claims.tid,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Token verification failed: ${error.message}`)
    }
    throw new Error('Token verification failed')
  }
}

// Include options for user queries
const userInclude = {
  organization: {
    select: { id: true, name: true, slug: true },
  },
  assignedLots: {
    include: {
      parkingLot: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
} as const

/**
 * Find or create a user from Microsoft authentication
 * Note: Uses type assertions for authProvider/providerUserId fields
 * which are added in the migration. Before migration runs, these
 * queries will fail at runtime but that's expected.
 */
export async function findOrCreateMicrosoftUser(verifiedUser: VerifiedMicrosoftUser): Promise<UserWithRelations> {
  // First, check if user exists by provider ID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user = await (prisma.user.findFirst as any)({
    where: {
      authProvider: AuthProvider.MICROSOFT,
      providerUserId: verifiedUser.oid,
    },
    include: userInclude,
  }) as UserWithRelations | null

  if (user) {
    return user
  }

  // Check if user exists by email (might have been created with local auth)
  user = await prisma.user.findUnique({
    where: { email: verifiedUser.email },
    include: userInclude,
  })

  if (user) {
    // User exists with local auth - link Microsoft account
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user = await (prisma.user.update as any)({
      where: { id: user.id },
      data: {
        authProvider: AuthProvider.MICROSOFT,
        providerUserId: verifiedUser.oid,
      },
      include: userInclude,
    }) as UserWithRelations
    return user
  }

  // Auto-create user if enabled
  const autoCreate = process.env.AZURE_AD_AUTO_CREATE_USERS !== 'false'
  if (!autoCreate) {
    throw new Error('User not found and auto-creation is disabled')
  }

  // Get default role from env or use ADMIN
  const defaultRole = (process.env.AZURE_AD_DEFAULT_ROLE as UserRole) || UserRole.ADMIN

  // Get organization - use env variable or first available
  let organizationId = process.env.AZURE_AD_DEFAULT_ORGANIZATION_ID

  if (!organizationId) {
    // Get first available organization
    const firstOrg = await prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    })

    if (!firstOrg) {
      throw new Error('No organization available for new user')
    }

    organizationId = firstOrg.id
  }

  // Create new user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user = await (prisma.user.create as any)({
    data: {
      email: verifiedUser.email,
      name: verifiedUser.name,
      role: defaultRole,
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.MICROSOFT,
      providerUserId: verifiedUser.oid,
      organizationId,
    },
    include: userInclude,
  }) as UserWithRelations

  return user
}

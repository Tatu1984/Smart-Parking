/**
 * Per-camera ingest token handling for EDGE_PUSH cameras.
 *
 * The Edge Agent presents this token as a Bearer credential when uploading HLS
 * segments. We must (a) look up the camera by the presented token efficiently,
 * and (b) never store the token in a reversible form.
 *
 * The app's generic hash() uses a random per-call salt, which is great for
 * passwords but can't be used for a lookup (you can't query by it). So we store
 * a DETERMINISTIC keyed hash (HMAC-SHA256 with a server secret) as an indexed
 * column: same token → same hash → single-row lookup, while a DB leak alone does
 * not let an attacker forge a token without also knowing the server secret.
 */

import crypto from 'crypto'
import { logger } from '@/lib/logger'

/** Prefix makes tokens identifiable in logs/config without revealing them. */
const TOKEN_PREFIX = 'edge_'

function ingestSecret(): string {
  // Reuse an existing server secret so we don't add another required env var.
  // ENCRYPTION_KEY is already required in production (see env.config).
  const secret = process.env.INGEST_TOKEN_SECRET || process.env.ENCRYPTION_KEY || process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('No secret available for ingest token hashing (set ENCRYPTION_KEY)')
    }
    logger.warn('Using development fallback secret for ingest token hashing')
    return 'dev-ingest-secret-not-for-production'
  }
  return secret
}

/** Generate a new opaque ingest token (shown to the operator once). */
export function generateIngestToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url')
}

/** Deterministic keyed hash used as the indexed lookup key for a token. */
export function hashIngestToken(token: string): string {
  return crypto.createHmac('sha256', ingestSecret()).update(token).digest('base64url')
}

/** Constant-time comparison of a presented token against a stored hash. */
export function verifyIngestToken(token: string, storedHash: string | null): boolean {
  if (!token || !storedHash) return false
  const computed = hashIngestToken(token)
  const a = Buffer.from(computed)
  const b = Buffer.from(storedHash)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

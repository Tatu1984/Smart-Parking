import { describe, it, expect, beforeAll } from 'vitest'
import { generateIngestToken, hashIngestToken, verifyIngestToken } from './ingest-token'

beforeAll(() => {
  process.env.INGEST_TOKEN_SECRET = 'test-ingest-secret'
})

describe('ingest tokens', () => {
  it('generates prefixed, unique tokens', () => {
    const a = generateIngestToken()
    const b = generateIngestToken()
    expect(a.startsWith('edge_')).toBe(true)
    expect(a).not.toBe(b)
  })

  it('hashes deterministically (same token → same hash) for lookup', () => {
    const t = generateIngestToken()
    expect(hashIngestToken(t)).toBe(hashIngestToken(t))
  })

  it('produces different hashes for different tokens', () => {
    expect(hashIngestToken(generateIngestToken())).not.toBe(hashIngestToken(generateIngestToken()))
  })

  it('the hash is not the token itself (not reversible-looking)', () => {
    const t = generateIngestToken()
    expect(hashIngestToken(t)).not.toContain(t)
  })

  it('verifies a matching token against its stored hash', () => {
    const t = generateIngestToken()
    expect(verifyIngestToken(t, hashIngestToken(t))).toBe(true)
  })

  it('rejects a wrong token', () => {
    const t = generateIngestToken()
    expect(verifyIngestToken(generateIngestToken(), hashIngestToken(t))).toBe(false)
  })

  it('rejects empty/null inputs', () => {
    expect(verifyIngestToken('', hashIngestToken('x'))).toBe(false)
    expect(verifyIngestToken('x', null)).toBe(false)
  })
})

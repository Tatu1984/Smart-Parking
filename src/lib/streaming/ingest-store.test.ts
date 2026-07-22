import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { resolveIngestPath, atomicWrite, readFile, removeFile, playlistMtime } from './ingest-store'

let tmpRoot: string

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ingest-test-'))
  process.env.EDGE_INGEST_DIR = tmpRoot
})

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

describe('resolveIngestPath — path safety', () => {
  it('accepts a normal playlist/segment', () => {
    expect(resolveIngestPath('cam1', 'index.m3u8').ok).toBe(true)
    expect(resolveIngestPath('cam1', 'seg-00001.ts').ok).toBe(true)
    expect(resolveIngestPath('cam1', 'part.m4s').ok).toBe(true)
  })

  it('rejects path traversal in the filename', () => {
    expect(resolveIngestPath('cam1', '../secret.ts').ok).toBe(false)
    expect(resolveIngestPath('cam1', '../../etc/passwd').ok).toBe(false)
    expect(resolveIngestPath('cam1', 'sub/dir/x.ts').ok).toBe(false)
  })

  it('rejects traversal in the stream key', () => {
    expect(resolveIngestPath('../other', 'index.m3u8').ok).toBe(false)
    expect(resolveIngestPath('a/b', 'index.m3u8').ok).toBe(false)
  })

  it('rejects disallowed extensions', () => {
    expect(resolveIngestPath('cam1', 'evil.sh').ok).toBe(false)
    expect(resolveIngestPath('cam1', 'x.php').ok).toBe(false)
    expect(resolveIngestPath('cam1', 'noext').ok).toBe(false)
  })

  it('keeps different streams isolated', () => {
    const a = resolveIngestPath('camA', 'index.m3u8')
    const b = resolveIngestPath('camB', 'index.m3u8')
    expect(a.full).not.toBe(b.full)
    expect(path.dirname(a.full)).not.toBe(path.dirname(b.full))
  })

  it('sets the right content type', () => {
    expect(resolveIngestPath('c', 'index.m3u8').contentType).toBe('application/vnd.apple.mpegurl')
    expect(resolveIngestPath('c', 'x.ts').contentType).toBe('video/mp2t')
  })
})

describe('atomicWrite / read / remove / mtime', () => {
  it('writes then reads back the same bytes', async () => {
    const { full } = resolveIngestPath('cam1', 'seg-1.ts')
    await atomicWrite(full, Buffer.from('hello-bytes'))
    const back = await readFile(full)
    expect(back?.toString()).toBe('hello-bytes')
  })

  it('leaves no .tmp files behind after a successful write', async () => {
    const { full } = resolveIngestPath('cam1', 'index.m3u8')
    await atomicWrite(full, Buffer.from('#EXTM3U'))
    const files = await fs.readdir(path.dirname(full))
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('removeFile is idempotent (missing file is fine)', async () => {
    const { full } = resolveIngestPath('cam1', 'seg-1.ts')
    await removeFile(full)
    await expect(removeFile(full)).resolves.toBeUndefined()
  })

  it('playlistMtime returns a recent time after writing the playlist', async () => {
    const { full } = resolveIngestPath('camX', 'index.m3u8')
    await atomicWrite(full, Buffer.from('#EXTM3U'))
    const mtime = await playlistMtime('camX')
    expect(mtime).not.toBeNull()
    expect(Date.now() - mtime!.getTime()).toBeLessThan(5000)
  })

  it('playlistMtime is null for an unknown stream', async () => {
    expect(await playlistMtime('does-not-exist')).toBeNull()
  })
})

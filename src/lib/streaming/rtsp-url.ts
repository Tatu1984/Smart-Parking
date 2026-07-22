/**
 * RTSP URL construction with correct credential encoding.
 *
 * Ported (in spirit) from the reference project's buildRTSPURL — a real-camera
 * test there hit the "@ in the password" bug: a password like `admin@123`
 * collides with RTSP URL syntax (`rtsp://user:pass@host`) and must be
 * percent-encoded (`admin%40123`) or the URL parses wrongly. WHATWG `URL`'s
 * `username`/`password` setters do that encoding for us.
 *
 * Credentials handled here are DECRYPTED plaintext — this runs server-side only
 * and its output (a credentialed RTSP URL) is used ONLY to configure the
 * streaming provider. It is never sent to a browser.
 */

export interface BuildRtspUrlInput {
  /** Full RTSP URL as stored on the camera. May already embed credentials. */
  rtspUrl: string
  /** Optional decrypted credentials to inject when the URL has none. */
  username?: string | null
  password?: string | null
}

/**
 * Returns an RTSP URL with credentials correctly encoded.
 *
 * - If `rtspUrl` already contains credentials (a userinfo `@` before the path),
 *   it is trusted and returned unchanged.
 * - Otherwise, when username/password are supplied, they are injected and
 *   percent-encoded.
 * - Malformed URLs are returned unchanged (the provider will surface the error).
 */
export function buildCredentialedRtspUrl(input: BuildRtspUrlInput): string {
  const { rtspUrl, username, password } = input
  if (!rtspUrl) return rtspUrl

  let url: URL
  try {
    url = new URL(rtspUrl)
  } catch {
    // Not a parseable URL — hand it back as-is; caller/provider will error out.
    return rtspUrl
  }

  // If the URL already carries credentials, don't touch it.
  if (url.username || url.password) {
    return url.toString()
  }

  if (username) {
    // Setting these on a URL object percent-encodes reserved chars (@, :, /...).
    url.username = username
    if (password) url.password = password
  }

  return url.toString()
}

/** Redacts credentials from an RTSP URL for safe logging. */
export function redactRtspUrl(rtspUrl: string): string {
  if (!rtspUrl) return rtspUrl
  try {
    const url = new URL(rtspUrl)
    if (url.username || url.password) {
      url.username = '***'
      url.password = '***'
    }
    return url.toString()
  } catch {
    // Fall back to a coarse regex redaction of any userinfo section.
    return rtspUrl.replace(/\/\/[^/@]+@/, '//***:***@')
  }
}

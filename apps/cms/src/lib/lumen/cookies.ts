// The Lumen session on the CMS host (lumen-payload-console design §1, §6):
// the bearer token api-edge issued, in one httpOnly cookie that only this
// host receives. Pure helpers, no Payload or Workers imports: tests/cms
// exercises them directly.

export const LUMEN_SESSION_COOKIE = 'lumen_session'

/** The longest a session cookie lives, whatever the token says (Lumen's own limit is 30 days). */
export const MAX_SESSION_SECONDS = 30 * 24 * 60 * 60

/** A cookie's value from a Cookie header, or null. */
export function readCookie(headers: Headers, name: string): string | null {
  const cookie = headers.get('cookie') ?? ''
  for (const part of cookie.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    try {
      const value = decodeURIComponent(part.slice(eq + 1).trim())
      return value.length > 0 ? value : null
    } catch {
      return null
    }
  }
  return null
}

/** The Set-Cookie that stores a session until it expires (at most MAX_SESSION_SECONDS). */
export function sessionCookie(token: string, expiresAt: string | null | undefined, secure: boolean, now = Date.now()): string {
  const expiry = expiresAt ? Date.parse(expiresAt) : NaN
  const seconds = Number.isFinite(expiry) ? Math.floor((expiry - now) / 1000) : MAX_SESSION_SECONDS
  const maxAge = Math.max(0, Math.min(seconds, MAX_SESSION_SECONDS))
  return [
    `${LUMEN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

/** The Set-Cookie that removes the session. */
export function clearedSessionCookie(secure: boolean): string {
  return [`${LUMEN_SESSION_COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax', secure ? 'Secure' : '']
    .filter(Boolean)
    .join('; ')
}

/**
 * Where to go after signing in: a path inside the admin, or the admin itself.
 * Never another host, a protocol-relative URL or a path outside /admin.
 */
export function safeAdminRedirect(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/admin')) return '/admin'
  if (raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return '/admin'
  const next = raw.slice('/admin'.length)
  if (next !== '' && !next.startsWith('/') && !next.startsWith('?') && !next.startsWith('#')) return '/admin'
  return raw
}

/**
 * A request another site's page made in the background (fetch, form, image)
 * rather than a person following a link. The session cookie is SameSite=Lax,
 * so browsers already withhold it from most of these; this refuses the rest.
 * Requests without Fetch Metadata (curl, old browsers) are not refused.
 */
export function isCrossSiteNonNavigation(headers: Headers): boolean {
  return headers.get('sec-fetch-site') === 'cross-site' && headers.get('sec-fetch-mode') !== 'navigate'
}

/**
 * A request that names another origin as its sender. Browsers send Origin on
 * every POST, PUT, PATCH and DELETE (a form or fetch) and on cross-origin
 * fetches, so this is what stops another page, including a sibling Worker on
 * the same workers.dev site (SameSite does not separate those), from writing
 * through Payload's API with the session cookie. It does for the Lumen cookie
 * what Payload's `csrf` allowlist does for Payload's own cookie, which is off
 * here. Only the Host header names this CMS here: an auth strategy gets no
 * URL, and a page elsewhere cannot set Host. Following a link sends no
 * Origin, so links into the admin from anywhere still sign people in.
 */
export function isForeignOrigin(headers: Headers): boolean {
  const presented = headers.get('origin')
  if (presented === null) return false
  const host = headers.get('host')
  if (!host || presented === 'null') return true
  try {
    return new URL(presented).host !== host.toLowerCase()
  } catch {
    return true
  }
}

/**
 * True only when the browser says the request comes from this CMS. "This
 * CMS" is the request URL's origin, or the same scheme with the Host header
 * (a local `wrangler dev` rewrites the URL's host to localhost). A page on
 * another site makes the browser send that site's Origin; it cannot change
 * Host.
 */
export function isSameOrigin(headers: Headers, requestUrl: string): boolean {
  const presented = headers.get('origin')
  if (!presented) return false
  const url = new URL(requestUrl)
  if (presented === url.origin) return true
  const host = headers.get('host')
  return host !== null && presented === `${url.protocol}//${host}`
}

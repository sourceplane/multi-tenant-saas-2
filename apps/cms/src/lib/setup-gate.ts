// The first-admin gate (lumen-payload-cms design §4, lumen-payload-console
// design §3). Anyone with a Lumen account can sign in, and on stage anyone can
// get one, so becoming the FIRST admin requires a token equal to the Worker
// secret CMS_SETUP_TOKEN, which only the owner can set. Without that secret,
// setup is closed and every new account stays pending.
//
// Pure functions, no Payload imports: tests/cms exercises them directly.

export const SETUP_COOKIE = 'cms_setup'
export const SETUP_HEADER = 'x-cms-setup-token'
/** A token shorter than this is refused even if it matches: setup must not be
 *  openable with something guessable. */
export const MIN_SETUP_TOKEN_LENGTH = 16

export const SETUP_CLOSED_MESSAGE =
  'CMS setup is closed. To create the first admin, set the Worker secret ' +
  'CMS_SETUP_TOKEN (at least 16 characters) and open /setup?token=<it>.'

/** The token a request presents: the setup header first, then the cookie. */
export function presentedSetupToken(headers: Headers): string | null {
  const header = headers.get(SETUP_HEADER)
  if (header) return header.trim()
  const cookie = headers.get('cookie') ?? ''
  for (const part of cookie.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === SETUP_COOKIE) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}

/** Open only when the owner set a long-enough secret and the request presents it. */
export function setupIsOpen(expected: string | null | undefined, presented: string | null): boolean {
  if (!expected || expected.length < MIN_SETUP_TOKEN_LENGTH || !presented) return false
  return constantTimeEqual(expected, presented)
}

/** Compares every byte regardless of where the first difference is. */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  let diff = left.length ^ right.length
  const n = Math.max(left.length, right.length)
  for (let i = 0; i < n; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  return diff === 0
}

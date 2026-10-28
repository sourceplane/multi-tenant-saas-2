import { lumenCall, type LumenSessionResponse, type LumenTransport, type LumenUser } from './client'

// Whether a Lumen session is live, asked of api-edge (GET /v1/auth/session)
// and remembered per isolate for SESSION_CACHE_MS, the same window api-edge
// gives its own actor cache. Keyed on the token's SHA-256, never the token.
// A revoked session therefore stops working within that window.

export type LumenSession = { user: LumenUser; expiresAt: string }

export const SESSION_CACHE_MS = 30_000
const MAX_ENTRIES = 1000

type Entry = { at: number; value: LumenSession | null }
const cache = new Map<string, Entry>()

export async function tokenKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The session behind a token, or null when api-edge says it is not one (401,
 * 403) or cannot be asked. Only answers api-edge actually gave are cached: an
 * outage fails closed for this request and is asked again on the next.
 */
export async function resolveSession(
  transport: LumenTransport,
  token: string,
  now: number = Date.now(),
): Promise<LumenSession | null> {
  const key = await tokenKey(token)
  const hit = cache.get(key)
  if (hit && now - hit.at < SESSION_CACHE_MS) return hit.value

  const result = await lumenCall<LumenSessionResponse>(transport, '/v1/auth/session', { token })
  let value: LumenSession | null
  if (result.ok && result.data?.user?.id && result.data.user.email) {
    value = { user: result.data.user, expiresAt: result.data.session.expiresAt }
  } else if (!result.ok && (result.status === 401 || result.status === 403)) {
    value = null
  } else {
    return null
  }
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(key, { at: now, value })
  return value
}

/** Drop a token from the cache (sign-out), so the next request asks api-edge again. */
export async function forgetSession(token: string): Promise<void> {
  cache.delete(await tokenKey(token))
}

/** For tests. */
export function clearSessionCache(): void {
  cache.clear()
}

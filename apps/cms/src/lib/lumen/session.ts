import { lumenCall, type LumenSessionResponse, type LumenTransport, type LumenUser } from './client'

// Whether a Lumen session is live, asked of api-edge (GET /v1/auth/session)
// and remembered per isolate for SESSION_CACHE_MS, the same window api-edge
// gives its own actor cache. Keyed on the token's SHA-256, never the token.
// A revoked session therefore stops working within that window.
//
// Two things keep a busy admin from asking too often or being signed out by a
// blip: concurrent requests with one token share a single lookup, and when
// api-edge cannot answer (rate limited, an error, unreachable) a session it
// confirmed in the last STALE_MAX_MS is still honoured until it expires.

export type LumenSession = { user: LumenUser; expiresAt: string }

export const SESSION_CACHE_MS = 30_000
/** How long a confirmed session survives api-edge being unable to answer. */
export const STALE_MAX_MS = 5 * 60_000
/** After api-edge fails to answer, how long to keep using the confirmed session before asking again. */
export const RETRY_AFTER_MS = 5_000
const MAX_ENTRIES = 1000

type Entry = { at: number; value: LumenSession | null; retryAt?: number }
const cache = new Map<string, Entry>()
const inFlight = new Map<string, Promise<LumenSession | null>>()

export async function tokenKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function remember(key: string, entry: Entry): void {
  if (!cache.has(key) && cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(key, entry)
}

/**
 * The session behind a token, or null when api-edge says it is not one (401,
 * 403), or cannot be asked and has not confirmed it recently. Only answers
 * api-edge actually gave are cached.
 */
export async function resolveSession(
  transport: LumenTransport,
  token: string,
  now: number = Date.now(),
): Promise<LumenSession | null> {
  const key = await tokenKey(token)
  const hit = cache.get(key)
  if (hit && now - hit.at < SESSION_CACHE_MS) return hit.value
  if (hit?.retryAt && now < hit.retryAt && usable(hit, now)) return hit.value

  const pending = inFlight.get(key)
  if (pending) return pending
  const lookup = ask(transport, token, key, hit, now).finally(() => inFlight.delete(key))
  inFlight.set(key, lookup)
  return lookup
}

async function ask(transport: LumenTransport, token: string, key: string, previous: Entry | undefined, now: number) {
  const result = await lumenCall<LumenSessionResponse>(transport, '/v1/auth/session', { token })
  if (result.ok && result.data?.user?.id && result.data.user.email) {
    const value = { user: result.data.user, expiresAt: result.data.session.expiresAt }
    remember(key, { at: now, value })
    return value
  }
  if (result.ok === false && (result.status === 401 || result.status === 403)) {
    remember(key, { at: now, value: null })
    return null
  }
  // api-edge could not answer: fail closed, unless it confirmed this session
  // recently and the session has not expired since.
  if (previous && usable(previous, now)) {
    remember(key, { at: previous.at, value: previous.value, retryAt: now + RETRY_AFTER_MS })
    return previous.value
  }
  return null
}

/** A confirmed session still inside the stale window and not expired. */
function usable(entry: Entry, now: number): boolean {
  return entry.value !== null && now - entry.at < STALE_MAX_MS && Date.parse(entry.value.expiresAt) > now
}

/** Drop a token from the cache (sign-out), so the next request asks api-edge again. */
export async function forgetSession(token: string): Promise<void> {
  cache.delete(await tokenKey(token))
}

/** For tests. */
export function clearSessionCache(): void {
  cache.clear()
  inFlight.clear()
}

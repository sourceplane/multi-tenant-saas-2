import type { LumenTransport } from '@cms/lib/lumen/client'
import { clearSessionCache, forgetSession, resolveSession, RETRY_AFTER_MS, SESSION_CACHE_MS, STALE_MAX_MS } from '@cms/lib/lumen/session'

// Asking api-edge whether a token is a live session, and remembering the
// answer for 30 seconds (design §2).

const user = { id: 'usr_0123', email: 'ed@example.com', displayName: 'Ed' }
const ok = () =>
  new Response(JSON.stringify({ data: { session: { id: 'ses_1', expiresAt: '2026-11-27T00:00:00Z' }, user } }), { status: 200 })
const status = (code: number) => new Response(JSON.stringify({ error: { code: 'x', message: 'x' } }), { status: code })

function transport(responses: Array<() => Response | Promise<Response>>) {
  const calls: Array<{ path: string; auth: string | null }> = []
  const fn: LumenTransport = async (path, init) => {
    calls.push({ path, auth: new Headers(init.headers).get('authorization') })
    const next = responses.shift()
    if (!next) throw new Error('no more responses')
    return next()
  }
  return { fn, calls }
}

beforeEach(() => clearSessionCache())

describe('resolveSession', () => {
  it('asks api-edge with the bearer token and returns who it is', async () => {
    const t = transport([ok])
    await expect(resolveSession(t.fn, 'tok', 0)).resolves.toEqual({ user, expiresAt: '2026-11-27T00:00:00Z' })
    expect(t.calls).toEqual([{ path: '/v1/auth/session', auth: 'Bearer tok' }])
  })

  it('remembers the answer for 30 seconds, then asks again', async () => {
    const t = transport([ok, () => status(401)])
    await resolveSession(t.fn, 'tok', 0)
    await expect(resolveSession(t.fn, 'tok', SESSION_CACHE_MS - 1)).resolves.not.toBeNull()
    expect(t.calls).toHaveLength(1)
    await expect(resolveSession(t.fn, 'tok', SESSION_CACHE_MS)).resolves.toBeNull()
    expect(t.calls).toHaveLength(2)
  })

  it('remembers a refusal too', async () => {
    const t = transport([() => status(401)])
    await expect(resolveSession(t.fn, 'bad', 0)).resolves.toBeNull()
    await expect(resolveSession(t.fn, 'bad', 1000)).resolves.toBeNull()
    expect(t.calls).toHaveLength(1)
  })

  it('fails closed and does not remember when api-edge is down', async () => {
    const t = transport([() => status(503), () => Promise.reject(new Error('reset')), ok])
    await expect(resolveSession(t.fn, 'tok', 0)).resolves.toBeNull()
    await expect(resolveSession(t.fn, 'tok', 1)).resolves.toBeNull()
    await expect(resolveSession(t.fn, 'tok', 2)).resolves.not.toBeNull()
    expect(t.calls).toHaveLength(3)
  })

  it('asks once for concurrent requests with the same token', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const t = transport([async () => (await gate, ok())])
    const all = Promise.all([resolveSession(t.fn, 'tok', 0), resolveSession(t.fn, 'tok', 0), resolveSession(t.fn, 'tok', 0)])
    release()
    const sessions = await all
    expect(sessions.every((s) => s?.user.id === user.id)).toBe(true)
    expect(t.calls).toHaveLength(1)
  })

  it('keeps a confirmed session through a rate limit or an outage, briefly, without re-asking each time', async () => {
    const t = transport([ok, () => status(429), () => status(503), () => status(429)])
    await expect(resolveSession(t.fn, 'tok', 0)).resolves.not.toBeNull()
    const later = SESSION_CACHE_MS + 1
    await expect(resolveSession(t.fn, 'tok', later)).resolves.not.toBeNull() // 429: the confirmed session stands
    await expect(resolveSession(t.fn, 'tok', later + 1)).resolves.not.toBeNull() // backing off: not asked
    expect(t.calls).toHaveLength(2)
    await expect(resolveSession(t.fn, 'tok', later + RETRY_AFTER_MS + 1)).resolves.not.toBeNull() // 503: still stands
    expect(t.calls).toHaveLength(3)
    // Past the stale window, failure means signed out.
    await expect(resolveSession(t.fn, 'tok', STALE_MAX_MS + 1)).resolves.toBeNull()
  })

  it('never keeps a session api-edge refused, or one that has expired', async () => {
    const t = transport([ok, () => status(401), () => status(429)])
    await resolveSession(t.fn, 'tok', 0)
    await expect(resolveSession(t.fn, 'tok', SESSION_CACHE_MS + 1)).resolves.toBeNull()
    await expect(resolveSession(t.fn, 'tok', 2 * SESSION_CACHE_MS + 2)).resolves.toBeNull()
    const expired = transport([
      () => new Response(JSON.stringify({ data: { session: { id: 's', expiresAt: '1970-01-01T00:00:40Z' }, user } }), { status: 200 }),
      () => status(503),
    ])
    clearSessionCache()
    await resolveSession(expired.fn, 'old', 0)
    await expect(resolveSession(expired.fn, 'old', 41_000)).resolves.toBeNull()
  })

  it('keeps tokens apart, and forgets one on sign-out', async () => {
    const t = transport([ok, () => status(401), () => status(401)])
    await expect(resolveSession(t.fn, 'a', 0)).resolves.not.toBeNull()
    await expect(resolveSession(t.fn, 'b', 0)).resolves.toBeNull()
    await forgetSession('a')
    await expect(resolveSession(t.fn, 'a', 1)).resolves.toBeNull()
    expect(t.calls).toHaveLength(3)
  })
})

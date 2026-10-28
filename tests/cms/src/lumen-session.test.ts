import type { LumenTransport } from '@cms/lib/lumen/client'
import { clearSessionCache, forgetSession, resolveSession, SESSION_CACHE_MS } from '@cms/lib/lumen/session'

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

  it('keeps tokens apart, and forgets one on sign-out', async () => {
    const t = transport([ok, () => status(401), () => status(401)])
    await expect(resolveSession(t.fn, 'a', 0)).resolves.not.toBeNull()
    await expect(resolveSession(t.fn, 'b', 0)).resolves.toBeNull()
    await forgetSession('a')
    await expect(resolveSession(t.fn, 'a', 1)).resolves.toBeNull()
    expect(t.calls).toHaveLength(3)
  })
})

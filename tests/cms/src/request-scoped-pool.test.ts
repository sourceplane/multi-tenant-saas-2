import { EventEmitter } from 'node:events'

import { RequestScopedPool, requestScopedPg } from '@cms/lib/request-scoped-pool'

// workerd binds a socket to the request that opened it, so the CMS must never
// hand one request a client another request opened (lib/request-scoped-pool.ts).
// A fake Client stands in for pg's: what matters is that every query and every
// transaction gets a client of its own, and that each is closed after.

class FakeClient extends EventEmitter {
  static made: FakeClient[] = []
  static failConnect = false
  connected = false
  ended = 0
  queries: unknown[] = []
  constructor(public options: Record<string, unknown>) {
    super()
    FakeClient.made.push(this)
  }
  async connect() {
    if (FakeClient.failConnect) throw new Error('connect refused')
    this.connected = true
  }
  async query(text: unknown) {
    if (!this.connected) throw new Error('query before connect')
    if (this.ended) throw new Error('query after end')
    this.queries.push(text)
    if (text === 'boom') throw new Error('query failed')
    return { rows: [{ text }] }
  }
  async end() {
    this.ended += 1
  }
}

const pool = () =>
  new RequestScopedPool({
    connectionString: 'postgres://u:p@h/db',
    connectionTimeoutMillis: 10_000,
    query_timeout: 25_000,
    Client: FakeClient as never,
  })

beforeEach(() => {
  FakeClient.made = []
  FakeClient.failConnect = false
})

describe('RequestScopedPool', () => {
  it('is what Payload gets as pg.Pool, and drizzle recognises it as a pool', () => {
    expect(requestScopedPg.Pool).toBe(RequestScopedPool)
    // drizzle-orm/node-postgres decides "pool or client" by this name.
    expect(RequestScopedPool.name).toContain('Pool')
  })

  it('opens a fresh client per query and closes it after', async () => {
    const p = pool()
    await Promise.all([p.query('one'), p.query('two'), p.query('three')])
    expect(FakeClient.made).toHaveLength(3)
    for (const c of FakeClient.made) {
      expect(c.queries).toHaveLength(1)
      expect(c.ended).toBe(1)
    }
  })

  it('passes the connection options through to the client', async () => {
    await pool().query('x')
    expect(FakeClient.made[0]!.options).toMatchObject({
      connectionString: 'postgres://u:p@h/db',
      connectionTimeoutMillis: 10_000,
      query_timeout: 25_000,
    })
  })

  it('closes the client when the query fails', async () => {
    await expect(pool().query('boom')).rejects.toThrow('query failed')
    expect(FakeClient.made[0]!.ended).toBe(1)
  })

  it('gives each connect() its own client, closed once on release (transactions)', async () => {
    const p = pool()
    const a = await p.connect()
    const b = await p.connect()
    expect(a).not.toBe(b)
    await a.query('BEGIN')
    a.release()
    a.release()
    expect(FakeClient.made[0]!.ended).toBe(1)
    expect(FakeClient.made[1]!.ended).toBe(0)
    b.release()
    expect(FakeClient.made[1]!.ended).toBe(1)
  })

  it('closes and rethrows when connecting fails', async () => {
    FakeClient.failConnect = true
    await expect(pool().connect()).rejects.toThrow('connect refused')
    expect(FakeClient.made[0]!.ended).toBe(1)
  })

  it('supports the callback forms', async () => {
    const p = pool()
    const viaQuery = await new Promise((resolve, reject) =>
      p.query('cb', (err: Error | undefined, res: unknown) => (err ? reject(err) : resolve(res))),
    )
    expect(viaQuery).toEqual({ rows: [{ text: 'cb' }] })
    const client = await new Promise<{ release: () => void }>((resolve, reject) =>
      p.connect((err: Error | undefined, c: { release: () => void }) => (err ? reject(err) : resolve(c))),
    )
    client.release()
    expect(FakeClient.made.every((c) => c.ended === 1)).toBe(true)
  })

  it('keeps an error event on a released client from reaching the isolate', async () => {
    const warnings: unknown[] = []
    const warn = console.warn
    console.warn = (...args: unknown[]) => void warnings.push(args)
    try {
      const c = await pool().connect()
      const fake = FakeClient.made[0]!
      fake.emit('error', new Error('in use'))
      expect(warnings).toHaveLength(1)
      c.release()
      // workerd cancelling a closed socket: expected, and not news.
      expect(() => fake.emit('error', new Error('Stream was cancelled.'))).not.toThrow()
      expect(warnings).toHaveLength(1)
    } finally {
      console.warn = warn
    }
  })

  it('ends cleanly with nothing open', async () => {
    await expect(pool().end()).resolves.toBeUndefined()
  })
})

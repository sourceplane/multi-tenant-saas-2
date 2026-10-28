import { APIError } from './stubs/payload'

import { Users } from '@cms/collections/Users'
import { SETUP_COOKIE, SETUP_HEADER } from '@cms/lib/setup-gate'

// Jest maps 'payload' to ./stubs/payload, so this is the class Users.ts throws.

type Hook = (args: Record<string, unknown>) => Promise<unknown>
const gate = Users.hooks!.beforeOperation![0] as unknown as Hook
const firstIsAdmin = Users.hooks!.beforeChange![0] as unknown as Hook

const TOKEN = 'owner-setup-token-0123456789'

function req({ users, user = null, headers = {} }: { users: number; user?: unknown; headers?: Record<string, string> }) {
  return {
    user,
    headers: new Headers(headers),
    payload: { count: async () => ({ totalDocs: users }) },
  }
}

describe('first-user gate (Users.beforeOperation)', () => {
  const saved = process.env.CMS_SETUP_TOKEN
  afterEach(() => {
    if (saved === undefined) delete process.env.CMS_SETUP_TOKEN
    else process.env.CMS_SETUP_TOKEN = saved
  })

  it('refuses the first account with 403 when setup was never opened', async () => {
    delete process.env.CMS_SETUP_TOKEN
    const err = await gate({ operation: 'create', req: req({ users: 0, headers: { [SETUP_HEADER]: TOKEN } }) }).catch((e) => e)
    expect(err).toBeInstanceOf(APIError)
    expect((err as APIError).status).toBe(403)
    expect((err as APIError).isPublic).toBe(true)
  })

  it('refuses the first account without the token, or with the wrong one', async () => {
    process.env.CMS_SETUP_TOKEN = TOKEN
    await expect(gate({ operation: 'create', req: req({ users: 0 }) })).rejects.toBeInstanceOf(APIError)
    await expect(
      gate({ operation: 'create', req: req({ users: 0, headers: { cookie: `${SETUP_COOKIE}=${TOKEN}x` } }) }),
    ).rejects.toBeInstanceOf(APIError)
  })

  it('allows the first account with the setup cookie or header', async () => {
    process.env.CMS_SETUP_TOKEN = TOKEN
    await expect(gate({ operation: 'create', req: req({ users: 0, headers: { cookie: `${SETUP_COOKIE}=${TOKEN}` } }) })).resolves.toBeUndefined()
    await expect(gate({ operation: 'create', req: req({ users: 0, headers: { [SETUP_HEADER]: TOKEN } }) })).resolves.toBeUndefined()
  })

  it('stays out of the way once an account exists (Payload refuses first-register itself)', async () => {
    delete process.env.CMS_SETUP_TOKEN
    await expect(gate({ operation: 'create', req: req({ users: 1 }) })).resolves.toBeUndefined()
  })

  it('never gates signed-in staff or other operations', async () => {
    delete process.env.CMS_SETUP_TOKEN
    await expect(gate({ operation: 'create', req: req({ users: 0, user: { role: 'admin' } }) })).resolves.toBeUndefined()
    for (const operation of ['read', 'update', 'delete', 'login', 'forgotPassword']) {
      await expect(gate({ operation, req: req({ users: 0 }) })).resolves.toBeUndefined()
    }
  })
})

describe('first user is admin (Users.beforeChange)', () => {
  it('makes the first account an admin whatever role it asked for', async () => {
    const data = await firstIsAdmin({ data: { email: 'o@example.com', role: 'editor' }, operation: 'create', req: req({ users: 0 }) })
    expect(data).toMatchObject({ role: 'admin' })
  })

  it('leaves later accounts as created', async () => {
    const data = await firstIsAdmin({ data: { email: 'e@example.com', role: 'editor' }, operation: 'create', req: req({ users: 3 }) })
    expect(data).toMatchObject({ role: 'editor' })
    const updated = await firstIsAdmin({ data: { role: 'editor' }, operation: 'update', req: req({ users: 0 }) })
    expect(updated).toMatchObject({ role: 'editor' })
  })
})

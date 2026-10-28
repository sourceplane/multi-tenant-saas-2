import { Users } from '@cms/collections/Users'

// Staff accounts sign in with Lumen only (multi-tenant-saas-2-console design
// §2, §3); learners are another collection and keep their own sign-in.

type AnyAccess = (args: { req: { user: unknown } }) => unknown
const call = (fn: unknown, user: unknown) => (fn as AnyAccess)({ req: { user } })
const field = (name: string) => Users.fields.find((f) => 'name' in f && f.name === name) as Record<string, unknown>

const admin = { id: 'a', collection: 'users', role: 'admin' }
const editor = { id: 'e', collection: 'users', role: 'editor' }
const instructor = { id: 'i', collection: 'users', role: 'instructor', tenants: ['t1'] }
const learner = { id: 'l', collection: 'learners' }
const pending = { id: 'p', collection: 'users', role: null }

describe('users', () => {
  it('has no Payload passwords: the local strategy is off, its columns stay, and Lumen is the strategy', () => {
    const auth = Users.auth as { disableLocalStrategy: unknown; strategies: Array<{ name: string }> }
    expect(auth.disableLocalStrategy).toEqual({ enableFields: true })
    expect(auth.strategies.map((s) => s.name)).toEqual(['lumen'])
  })

  it('has no first-register hooks left: the setup rule lives in account provisioning', () => {
    expect(Users.hooks?.beforeOperation).toBeUndefined()
    expect(Users.hooks?.beforeChange).toBeUndefined()
    expect(Users.hooks?.afterLogout).toHaveLength(1)
  })

  it('a role is optional with no default: no role means pending', () => {
    expect(field('role').required).toBeUndefined()
    expect(field('role').defaultValue).toBeUndefined()
    expect((field('role').options as Array<{ value: string }>).map((o) => o.value)).toEqual(['admin', 'editor', 'instructor'])
  })

  it('links to Lumen by a unique, read-only lumenUserId that no request can set', () => {
    const link = field('lumenUserId')
    expect(link).toMatchObject({ type: 'text', unique: true, index: true })
    const access = link.access as { create: () => boolean; update: () => boolean }
    expect(access.create()).toBe(false)
    expect(access.update()).toBe(false)
  })

  it('lets every staff role into the admin, never a pending account or a learner', () => {
    expect(call(Users.access!.admin, admin)).toBe(true)
    expect(call(Users.access!.admin, editor)).toBe(true)
    expect(call(Users.access!.admin, instructor)).toBe(true)
    expect(call(Users.access!.admin, pending)).toBe(false)
    expect(call(Users.access!.admin, learner)).toBe(false)
    expect(call(Users.access!.admin, null)).toBe(false)
  })

  it('a pending account reads only itself; only admins create, delete or read everyone', () => {
    expect(call(Users.access!.read, pending)).toEqual({ id: { equals: 'p' } })
    expect(call(Users.access!.read, admin)).toBe(true)
    expect(call(Users.access!.update, pending)).toBe(false)
    expect(call(Users.access!.create, editor)).toBe(false)
    expect(call(Users.access!.delete, editor)).toBe(false)
    expect(call(Users.access!.create, admin)).toBe(true)
    // A learner is not a staff account and reads none.
    expect(call(Users.access!.read, learner)).toBe(false)
  })

  it('keeps the academies an instructor manages, set only by admins', () => {
    const tenants = field('tenants') as Record<string, unknown> & { access: { update: unknown } }
    expect(tenants).toMatchObject({ type: 'relationship', relationTo: 'tenants', hasMany: true, saveToJWT: true })
    expect(call(tenants.access.update, admin)).toBe(true)
    expect(call(tenants.access.update, instructor)).toBe(false)
  })
})

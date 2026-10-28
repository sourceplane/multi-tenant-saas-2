import { Categories } from '@cms/collections/Categories'
import { Pages } from '@cms/collections/Pages'
import { Posts } from '@cms/collections/Posts'
import { Users } from '@cms/collections/Users'
import { adminOrSelf, anyone, isAdmin, isStaff, publishedOrStaff } from '@cms/lib/access'

// The rules the CMS promises (design §3, Routes): published pages, posts and
// categories are public; everything else needs a staff session; only admins
// delete content and manage accounts.

type AnyAccess = (args: { req: { user: unknown } }) => unknown
const as = (fn: unknown) => fn as AnyAccess
const call = (fn: unknown, user: unknown) => as(fn)({ req: { user } })

const anon = null
const admin = { id: 'a1', collection: 'users', role: 'admin' }
const editor = { id: 'e1', collection: 'users', role: 'editor' }
const foreign = { id: 'x1', collection: 'customers', role: 'admin' }

describe('access rules', () => {
  it('anyone', () => {
    expect(call(anyone, anon)).toBe(true)
  })

  it('isStaff: admins and editors of the users collection only', () => {
    expect(call(isStaff, anon)).toBe(false)
    expect(call(isStaff, admin)).toBe(true)
    expect(call(isStaff, editor)).toBe(true)
    expect(call(isStaff, foreign)).toBe(false)
    expect(call(isStaff, { id: 'n', collection: 'users' })).toBe(false)
  })

  it('isAdmin', () => {
    expect(call(isAdmin, anon)).toBe(false)
    expect(call(isAdmin, editor)).toBe(false)
    expect(call(isAdmin, admin)).toBe(true)
    expect(call(isAdmin, foreign)).toBe(false)
  })

  it('publishedOrStaff: staff see drafts, everyone else what is published', () => {
    expect(call(publishedOrStaff, admin)).toBe(true)
    expect(call(publishedOrStaff, editor)).toBe(true)
    expect(call(publishedOrStaff, anon)).toEqual({ _status: { equals: 'published' } })
    expect(call(publishedOrStaff, foreign)).toEqual({ _status: { equals: 'published' } })
  })

  it('adminOrSelf: admins see every account, editors only their own', () => {
    expect(call(adminOrSelf, admin)).toBe(true)
    expect(call(adminOrSelf, editor)).toEqual({ id: { equals: 'e1' } })
    expect(call(adminOrSelf, anon)).toBe(false)
    expect(call(adminOrSelf, foreign)).toBe(false)
  })
})

describe('collection contract', () => {
  const access = (c: { access?: Record<string, unknown> }) => c.access ?? {}

  it.each([
    ['pages', Pages],
    ['posts', Posts],
  ] as const)('%s: drafts and versions, published-only reads, staff writes, admin deletes', (slug, c) => {
    expect(c.slug).toBe(slug)
    expect(c.versions).toMatchObject({ drafts: true })
    expect(access(c).read).toBe(publishedOrStaff)
    expect(access(c).create).toBe(isStaff)
    expect(access(c).update).toBe(isStaff)
    expect(access(c).delete).toBe(isAdmin)
    expect(c.fields.map((f) => ('name' in f ? f.name : undefined))).toEqual(expect.arrayContaining(['title', 'slug', 'content']))
  })

  it('categories: public reads, staff writes, admin deletes', () => {
    expect(access(Categories).read).toBe(anyone)
    expect(access(Categories).create).toBe(isStaff)
    expect(access(Categories).delete).toBe(isAdmin)
  })

  it('users: staff-only admin panel, admin-managed accounts, editor by default', () => {
    expect(Users.auth).toBeTruthy()
    expect(access(Users).admin).toBe(isStaff)
    expect(access(Users).create).toBe(isAdmin)
    expect(access(Users).delete).toBe(isAdmin)
    expect(access(Users).read).toBe(adminOrSelf)
    expect(access(Users).update).toBe(adminOrSelf)
    const role = Users.fields.find((f) => 'name' in f && f.name === 'role') as Record<string, unknown> & {
      access: { create: unknown; update: unknown }
    }
    expect(role.defaultValue).toBe('editor')
    expect(role.saveToJWT).toBe(true)
    // Only an admin may set or change a role: an editor cannot promote themself.
    expect(call(role.access.update, editor)).toBe(false)
    expect(call(role.access.update, admin)).toBe(true)
    expect(call(role.access.create, anon)).toBe(false)
  })
})

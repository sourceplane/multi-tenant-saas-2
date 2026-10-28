import { Courses } from '@cms/collections/lms/Courses'
import { Lessons } from '@cms/collections/lms/Lessons'
import { Quizzes } from '@cms/collections/lms/Quizzes'
import { Tenants } from '@cms/collections/lms/Tenants'
import { anyone, isAdmin } from '@cms/lib/access'
import {
  canCreateInTenant,
  enforceTenantScope,
  publishedOrTenantStaff,
  tenantFromCourse,
  tenantIdsOf,
  tenantStaff,
  tenantStaffField,
  tenantStaffOrEnrolledField,
} from '@cms/lib/lms-access'

import { APIError } from './stubs/payload'

// Academy (tenant) scoping, design §2: admins see and change everything; an
// instructor changes only their own academies' courses, lessons and quizzes;
// everyone else sees what is published, and never an answer key.

type Fn = (args: Record<string, unknown>) => unknown
const run = (fn: unknown, args: Record<string, unknown>) => (fn as Fn)(args)
const withUser = (user: unknown) => ({ req: { user } })

const admin = { id: 'a', collection: 'users', role: 'admin' }
const editor = { id: 'e', collection: 'users', role: 'editor' }
const instructor = { id: 'i', collection: 'users', role: 'instructor', tenants: ['t1', { id: 't2' }] }
const unassigned = { id: 'u', collection: 'users', role: 'instructor', tenants: [] }
const published = { _status: { equals: 'published' } }

describe('tenantIdsOf', () => {
  it('reads ids whether populated or not, and ignores junk', () => {
    expect(tenantIdsOf(instructor as never)).toEqual(['t1', 't2'])
    expect(tenantIdsOf({ role: 'instructor', tenants: [null, '', { id: 't3' }] } as never)).toEqual(['t3'])
    expect(tenantIdsOf(null)).toEqual([])
    expect(tenantIdsOf(admin as never)).toEqual([])
  })
})

describe('read access', () => {
  const read = publishedOrTenantStaff(published)

  it('admins read everything', () => {
    expect(run(read, withUser(admin))).toBe(true)
  })

  it('instructors read their academies and what is published elsewhere', () => {
    expect(run(read, withUser(instructor))).toEqual({ or: [{ tenant: { in: ['t1', 't2'] } }, published] })
  })

  it('everyone else reads what is published', () => {
    expect(run(read, withUser(null))).toEqual(published)
    expect(run(read, withUser(editor))).toEqual(published)
  })

  it('lessons and quizzes follow their course', () => {
    const where = run(Lessons.access!.read, withUser(null))
    expect(where).toEqual({ 'course._status': { equals: 'published' } })
    expect(run(Quizzes.access!.read, withUser(null))).toEqual(where)
  })
})

describe('write access', () => {
  it('create: admins, and instructors with an academy', () => {
    expect(run(canCreateInTenant, withUser(admin))).toBe(true)
    expect(run(canCreateInTenant, withUser(instructor))).toBe(true)
    expect(run(canCreateInTenant, withUser(unassigned))).toBe(false)
    expect(run(canCreateInTenant, withUser(editor))).toBe(false)
    expect(run(canCreateInTenant, withUser(null))).toBe(false)
  })

  it('update and delete: admins everywhere, instructors in their academies only', () => {
    expect(run(tenantStaff, withUser(admin))).toBe(true)
    expect(run(tenantStaff, withUser(instructor))).toEqual({ tenant: { in: ['t1', 't2'] } })
    expect(run(tenantStaff, withUser(editor))).toBe(false)
    expect(run(tenantStaff, withUser(null))).toBe(false)
  })

  it('academies are managed by admins and readable by anyone', () => {
    expect(Tenants.access).toMatchObject({ read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin })
  })

  it('only admins delete a course', () => {
    expect(Courses.access!.delete).toBe(isAdmin)
  })
})

describe('enforceTenantScope', () => {
  const scope = (user: unknown, data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
    run(enforceTenantScope, { data, originalDoc, req: { user } })

  it('lets an instructor write in their own academy', () => {
    expect(scope(instructor, { tenant: 't1', title: 'x' })).toEqual({ tenant: 't1', title: 'x' })
    expect(scope(instructor, { title: 'x' }, { tenant: { id: 't2' } })).toEqual({ title: 'x' })
  })

  it("refuses an instructor writing in someone else's academy, or moving a row there", () => {
    expect(() => scope(instructor, { tenant: 't9' })).toThrow(APIError)
    expect(() => scope(instructor, { tenant: 't9' }, { tenant: 't1' })).toThrow(APIError)
    expect(() => scope(instructor, {})).toThrow(APIError)
  })

  it('never stops admins or the server itself (no user)', () => {
    expect(scope(admin, { tenant: 't9' })).toEqual({ tenant: 't9' })
    expect(scope(null, { tenant: 't9' })).toEqual({ tenant: 't9' })
  })

  it('refuses editors', () => {
    expect(() => scope(editor, { tenant: 't1' })).toThrow(APIError)
  })
})

describe('tenantFromCourse', () => {
  const req = { payload: { findByID: async ({ id }: { id: string }) => ({ id, tenant: id === 'c1' ? 't1' : { id: 't2' } }) } }

  it("takes a lesson's academy from its course, whatever the request said", async () => {
    await expect(run(tenantFromCourse, { data: { course: 'c1', tenant: 't9' }, req })).resolves.toEqual({ course: 'c1', tenant: 't1' })
    await expect(run(tenantFromCourse, { data: { title: 'x' }, originalDoc: { course: { id: 'c2' } }, req })).resolves.toEqual({ title: 'x', tenant: 't2' })
  })

  it('leaves data alone when there is no course yet', async () => {
    await expect(run(tenantFromCourse, { data: { title: 'x' }, req })).resolves.toEqual({ title: 'x' })
  })
})

describe('answer keys and lesson bodies', () => {
  const field = (args: { user: unknown; tenant?: unknown }) =>
    run(tenantStaffField, { req: { user: args.user }, doc: { tenant: args.tenant } })

  it('are for admins and the academy’s own instructors only', () => {
    expect(field({ user: admin, tenant: 't9' })).toBe(true)
    expect(field({ user: instructor, tenant: 't1' })).toBe(true)
    expect(field({ user: instructor, tenant: { id: 't2' } })).toBe(true)
    expect(field({ user: instructor, tenant: 't9' })).toBe(false)
    expect(field({ user: editor, tenant: 't1' })).toBe(false)
    expect(field({ user: null, tenant: 't1' })).toBe(false)
  })

  it('keep the answer key for staff; questions and lesson bodies for staff and enrolled learners', () => {
    const questions = Quizzes.fields.find((f) => 'name' in f && f.name === 'questions') as {
      access: { read: unknown }
      fields: Array<{ name: string; access?: { read: unknown } }>
    }
    expect(questions.access.read).toBe(tenantStaffOrEnrolledField)
    expect(questions.fields.find((f) => f.name === 'correctIndex')!.access!.read).toBe(tenantStaffField)
    for (const name of ['content', 'videoUrl']) {
      const f = Lessons.fields.find((x) => 'name' in x && x.name === name) as { access: { read: unknown } }
      expect(f.access.read).toBe(tenantStaffOrEnrolledField)
    }
  })

  it('validate correctIndex against the options given', () => {
    const questions = Quizzes.fields.find((f) => 'name' in f && f.name === 'questions') as {
      fields: Array<{ name: string; validate?: (v: unknown, o: unknown) => unknown }>
    }
    const validate = questions.fields.find((f) => f.name === 'correctIndex')!.validate!
    const siblingData = { options: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] }
    expect(validate(0, { siblingData })).toBe(true)
    expect(validate(2, { siblingData })).toBe(true)
    expect(validate(3, { siblingData })).toMatch(/Pick one of the 3 options/)
    expect(validate(-1, { siblingData })).not.toBe(true)
    expect(validate(1.5, { siblingData })).not.toBe(true)
  })
})

describe('learner records', () => {
  // Imported lazily so the suite above stays about the course model.
  const load = () => import('@cms/lib/lms-access')
  const learner = { id: 'L1', collection: 'learners', name: 'Lee' }

  it('records: admins all, instructors their academies, learners their own, strangers nothing', async () => {
    const { ownOrTenantStaff } = await load()
    expect(run(ownOrTenantStaff, withUser(admin))).toBe(true)
    expect(run(ownOrTenantStaff, withUser(instructor))).toEqual({ tenant: { in: ['t1', 't2'] } })
    expect(run(ownOrTenantStaff, withUser(learner))).toEqual({ learner: { equals: 'L1' } })
    expect(run(ownOrTenantStaff, withUser(editor))).toBe(false)
    expect(run(ownOrTenantStaff, withUser(null))).toBe(false)
  })

  it('asLearner recognises only learner sessions', async () => {
    const { asLearner } = await load()
    expect(asLearner(learner)).toBe(learner)
    expect(asLearner(admin)).toBeUndefined()
    expect(asLearner({ collection: 'learners' })).toBeUndefined()
    expect(asLearner(null)).toBeUndefined()
  })

  it('lesson bodies open to an enrolled learner, once per request', async () => {
    const { tenantStaffOrEnrolledField } = await load()
    let finds = 0
    const req = {
      user: learner,
      context: {},
      payload: { find: async () => (finds++, { docs: [{ course: 'c1' }, { course: { id: 'c2' } }] }) },
    }
    const read = (course: unknown) => run(tenantStaffOrEnrolledField, { req, doc: { course, tenant: 't1' } })
    await expect(read('c1')).resolves.toBe(true)
    await expect(read({ id: 'c2' })).resolves.toBe(true)
    await expect(read('c3')).resolves.toBe(false)
    expect(finds).toBe(1)
  })

  it('stay closed to anonymous visitors and staff of other academies', async () => {
    const { tenantStaffOrEnrolledField } = await load()
    const req = (user: unknown) => ({ user, context: {}, payload: { find: async () => ({ docs: [] }) } })
    await expect(run(tenantStaffOrEnrolledField, { req: req(null), doc: { course: 'c1', tenant: 't1' } })).resolves.toBe(false)
    await expect(run(tenantStaffOrEnrolledField, { req: req(instructor), doc: { course: 'c1', tenant: 't9' } })).resolves.toBe(false)
    await expect(run(tenantStaffOrEnrolledField, { req: req(instructor), doc: { course: 'c1', tenant: 't1' } })).resolves.toBe(true)
  })
})

describe('who can read a learner account', () => {
  const load = () => import('@cms/collections/lms/Learners')
  const learner = { id: 'L1', collection: 'learners' }
  const req = (user: unknown, enrolled: Array<{ learner: unknown }> = []) => ({
    user,
    payload: { find: async () => ({ docs: enrolled }) },
  })

  it('admins all; a learner only themself; strangers nobody', async () => {
    const { learnerReaders } = await load()
    await expect(run(learnerReaders, { req: req(admin) })).resolves.toBe(true)
    await expect(run(learnerReaders, { req: req(learner) })).resolves.toEqual({ id: { equals: 'L1' } })
    await expect(run(learnerReaders, { req: req(null) })).resolves.toBe(false)
    await expect(run(learnerReaders, { req: req(editor) })).resolves.toBe(false)
  })

  it("instructors: the learners enrolled in their academies, and nobody else's", async () => {
    const { learnerReaders } = await load()
    await expect(run(learnerReaders, { req: req(instructor, [{ learner: 'L1' }, { learner: { id: 'L2' } }, { learner: 'L1' }]) })).resolves.toEqual({
      id: { in: ['L1', 'L2'] },
    })
    await expect(run(learnerReaders, { req: req(instructor, []) })).resolves.toBe(false)
    await expect(run(learnerReaders, { req: req(unassigned, [{ learner: 'L1' }]) })).resolves.toBe(false)
  })
})

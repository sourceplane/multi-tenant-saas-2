import { APIError, type Access, type CollectionBeforeChangeHook, type CollectionBeforeValidateHook, type FieldAccess, type Where } from 'payload'

import { roleOf, type StaffUser } from './access'

// Tenancy for the learning domain. Every course, lesson and quiz belongs to
// one academy (a `tenants` row). Admins manage every academy; an instructor
// manages only the academies assigned to them (users.tenants); everyone else
// sees what is published.

type Rel = string | { id: string } | null | undefined
const idOf = (rel: Rel): string | undefined => (!rel ? undefined : typeof rel === 'string' ? rel : rel.id)

/** The academies an instructor manages (ids), whether `tenants` is populated or not. */
export function tenantIdsOf(user: StaffUser): string[] {
  const raw = (user as { tenants?: Rel[] } | null | undefined)?.tenants
  if (!Array.isArray(raw)) return []
  return raw.map(idOf).filter((id): id is string => typeof id === 'string' && id.length > 0)
}

const isInstructor = (user: StaffUser) => roleOf(user) === 'instructor'
const isAdminUser = (user: StaffUser) => roleOf(user) === 'admin'

/** Admins: all. Instructors: their academies, plus what is published anywhere. Others: published. */
export const publishedOrTenantStaff =
  (published: Where): Access =>
  ({ req: { user } }) => {
    const u = user as StaffUser
    if (isAdminUser(u)) return true
    if (isInstructor(u)) return { or: [{ tenant: { in: tenantIdsOf(u) } }, published] }
    return published
  }

/** Admins: all. Instructors: rows of their academies. Others: nothing. */
export const tenantStaff: Access = ({ req: { user } }) => {
  const u = user as StaffUser
  if (isAdminUser(u)) return true
  if (isInstructor(u)) return { tenant: { in: tenantIdsOf(u) } }
  return false
}

/**
 * Create: admins, and instructors with at least one academy. Which academy
 * the row lands in is checked by `enforceTenantScope`, after the tenant is
 * known (lessons and quizzes take it from their course).
 */
export const canCreateInTenant: Access = ({ req: { user } }) => {
  const u = user as StaffUser
  return isAdminUser(u) || (isInstructor(u) && tenantIdsOf(u).length > 0)
}

/** Field read for staff of the row's academy only (answer keys, unpublished detail). */
export const tenantStaffField: FieldAccess = ({ req: { user }, doc, siblingData }) => {
  const u = user as StaffUser
  if (isAdminUser(u)) return true
  if (!isInstructor(u)) return false
  const tenant = idOf((doc as { tenant?: Rel } | undefined)?.tenant ?? (siblingData as { tenant?: Rel } | undefined)?.tenant)
  return tenant !== undefined && tenantIdsOf(u).includes(tenant)
}

/** Lessons and quizzes belong to their course's academy: derive it, never trust it. */
export const tenantFromCourse: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const course = idOf((data?.course ?? originalDoc?.course) as Rel)
  if (!course || !data) return data
  const found = await req.payload.findByID({ collection: 'courses', id: course, depth: 0, overrideAccess: true, req })
  return { ...data, tenant: idOf(found.tenant as Rel) }
}

/** An instructor may write only inside their own academies. */
export const enforceTenantScope: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const u = req.user as StaffUser
  if (!u || isAdminUser(u)) return data
  const tenant = idOf((data?.tenant ?? originalDoc?.tenant) as Rel)
  if (isInstructor(u) && tenant && tenantIdsOf(u).includes(tenant)) return data
  throw new APIError('You can only change content in your own academies.', 403, undefined, true)
}

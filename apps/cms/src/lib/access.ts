import type { Access, FieldAccess, PayloadRequest } from 'payload'

// Staff roles. `editor` manages the site's pages and posts; `instructor`
// manages the courses of the academies (tenants) assigned to them; `admin`
// manages everything, including accounts and academies. An account with no
// role is pending: signed in with Lumen, not yet let in.
export type Role = 'admin' | 'editor' | 'instructor'
export type StaffUser = { id?: string; collection?: string; role?: Role | null; tenants?: unknown } | null | undefined

const isUsersRow = (user: StaffUser): boolean => Boolean(user && (user.collection === undefined || user.collection === 'users'))

export const roleOf = (user: StaffUser): Role | undefined => (user && isUsersRow(user) ? (user.role ?? undefined) : undefined)

export const anyone: Access = () => true
// Boolean-only (not Access): Payload's `access.admin` must answer yes or no.
export const isStaff = ({ req: { user } }: { req: PayloadRequest }): boolean => Boolean(roleOf(user as StaffUser))
export const isAdmin: Access = ({ req: { user } }) => roleOf(user as StaffUser) === 'admin'
export const isAdminField: FieldAccess = ({ req: { user } }) => roleOf(user as StaffUser) === 'admin'
/** Admins and editors: the site's pages, posts and categories. */
export const isEditor: Access = ({ req: { user } }) => {
  const role = roleOf(user as StaffUser)
  return role === 'admin' || role === 'editor'
}

/** Staff see drafts; everyone else sees what is published. */
export const publishedOrStaff: Access = ({ req: { user } }) =>
  roleOf(user as StaffUser) ? true : { _status: { equals: 'published' } }

/** Anyone signed in as staff reads their own account (a pending one too); admins read all. */
export const selfOrAdmin: Access = ({ req: { user } }) => {
  const u = user as StaffUser
  if (roleOf(u) === 'admin') return true
  if (u?.id && isUsersRow(u)) return { id: { equals: u.id } }
  return false
}

/** Admins manage every account; other staff read and edit their own. */
export const adminOrSelf: Access = ({ req: { user } }) => {
  const u = user as StaffUser
  if (roleOf(u) === 'admin') return true
  if (u?.id && roleOf(u)) return { id: { equals: u.id } }
  return false
}

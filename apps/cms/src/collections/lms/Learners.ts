import type { Access, CollectionConfig } from 'payload'

import { isAdmin, roleOf, type StaffUser } from '../../lib/access'
import { asLearner, tenantIdsOf } from '../../lib/lms-access'

const selfOrAdmin: Access = ({ req: { user } }) => {
  if (roleOf(user as StaffUser) === 'admin') return true
  const learner = asLearner(user)
  return learner ? { id: { equals: learner.id } } : false
}

/** Read: admins, the learner, and instructors for learners enrolled in their academies. */
export const learnerReaders: Access = async ({ req }) => {
  const user = req.user as StaffUser
  if (roleOf(user) === 'instructor') {
    const tenants = tenantIdsOf(user)
    if (tenants.length === 0) return false
    const { docs } = await req.payload.find({
      collection: 'enrolments',
      where: { tenant: { in: tenants } },
      depth: 0,
      pagination: false,
      select: { learner: true },
      overrideAccess: true,
      req,
    })
    const ids = [
      ...new Set(
        docs
          .map((d) => d.learner as string | { id: string } | null | undefined)
          .map((l) => (l && typeof l === 'object' ? l.id : l))
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ]
    return ids.length ? { id: { in: ids } } : false
  }
  return selfOrAdmin({ req })
}

// The learner app's accounts. Separate from staff (`users`): a learner can
// never reach /admin, and a staff role can never be set from here. Anyone may
// register; the name is what their certificates show. Instructors see the
// learners enrolled in their academies (name and email), nobody else's.
export const Learners: CollectionConfig = {
  slug: 'learners',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'email', 'createdAt'], group: 'Learning' },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7, // a week
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
    cookies: { sameSite: 'Lax' },
  },
  access: {
    read: learnerReaders,
    create: () => true,
    update: selfOrAdmin,
    delete: isAdmin,
    unlock: isAdmin,
  },
  fields: [{ name: 'name', type: 'text', required: true, maxLength: 120 }],
}

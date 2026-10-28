import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import { asLearner, type LearnerUser } from '../lib/lms-access'

/** Payload, and the learner signed in on this request (if any). Staff sessions do not count here. */
export async function learnerSession(): Promise<{ payload: Payload; learner: LearnerUser | undefined }> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return { payload, learner: asLearner(user) }
}

/** The options every learner-app read passes: the visitor's own access rules, never the server's. */
export const asVisitor = (learner: LearnerUser | undefined): { overrideAccess: false; user: never } => ({
  overrideAccess: false,
  // Payload's Local API applies this user's access rules (null: anonymous).
  user: (learner ? { ...learner, collection: 'learners' } : null) as never,
})

export const tokenCookieName = (payload: Payload) => `${payload.config.cookiePrefix || 'payload'}-token`

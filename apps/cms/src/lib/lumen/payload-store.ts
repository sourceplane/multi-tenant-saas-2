import type { Payload } from 'payload'

import type { Account, AccountStore } from './accounts'

// AccountStore over Payload's Local API. Access rules are bypassed on
// purpose: this runs while the request is still being authenticated, so there
// is no user yet to check them against. accountFor decides what is allowed.
export function payloadAccountStore(payload: Payload): AccountStore {
  const one = async (where: Record<string, unknown>): Promise<Account | null> => {
    const { docs } = await payload.find({ collection: 'users', where: where as never, limit: 1, depth: 0, overrideAccess: true })
    return (docs[0] as unknown as Account | undefined) ?? null
  }
  return {
    findByLumenId: (lumenUserId) => one({ lumenUserId: { equals: lumenUserId } }),
    findUnlinkedByEmail: (email) =>
      one({ and: [{ email: { equals: email.toLowerCase() } }, { lumenUserId: { exists: false } }] }),
    adminExists: async () => {
      const { totalDocs } = await payload.count({ collection: 'users', where: { role: { equals: 'admin' } }, overrideAccess: true })
      return totalDocs > 0
    },
    create: async (data) =>
      (await payload.create({
        collection: 'users',
        data: { ...data, email: data.email.toLowerCase() } as never,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Account,
    update: async (id, data) =>
      (await payload.update({ collection: 'users', id, data: data as never, depth: 0, overrideAccess: true })) as unknown as Account,
  }
}

import config from '@payload-config'
import { getPayload } from 'payload'

import type { FormDeps, FormUser } from './forms'
import { lumenTransport } from './transport'

// The runtime side of the account forms: Payload signs the request in (the
// lumen strategy), and the display name is copied onto the users row.
export const formDeps: FormDeps = {
  transport: lumenTransport,
  authenticate: async (headers) => {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers })
    return (user as FormUser | null) ?? null
  },
  syncName: async (userId, name) => {
    const payload = await getPayload({ config })
    await payload.update({ collection: 'users', id: userId, data: { name }, overrideAccess: true })
  },
}

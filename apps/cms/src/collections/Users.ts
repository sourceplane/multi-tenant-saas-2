import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeOperationHook, type CollectionConfig } from 'payload'

import { adminOrSelf, isAdmin, isAdminField, isStaff } from '../lib/access'
import { presentedSetupToken, SETUP_CLOSED_MESSAGE, setupIsOpen } from '../lib/setup-gate'

const noUsersYet = async (req: Parameters<CollectionBeforeOperationHook>[0]['req']): Promise<boolean> => {
  const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
  return totalDocs === 0
}

// Creating the first account — the only create an anonymous request can reach,
// through /api/users/first-register — needs the owner's setup token. Every
// later account is created by an admin, which the create rule enforces.
const firstUserGate: CollectionBeforeOperationHook = async ({ operation, req }) => {
  if (operation !== 'create' || req.user) return
  if (!(await noUsersYet(req))) return
  if (!setupIsOpen(process.env.CMS_SETUP_TOKEN, presentedSetupToken(req.headers))) {
    throw new APIError(SETUP_CLOSED_MESSAGE, 403, undefined, true)
  }
}

// Whoever creates the first account is its admin.
const firstUserIsAdmin: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation === 'create' && (await noUsersYet(req))) return { ...data, role: 'admin' }
  return data
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'name', 'role'] },
  access: {
    admin: isStaff,
    read: adminOrSelf,
    create: isAdmin,
    update: adminOrSelf,
    delete: isAdmin,
  },
  hooks: {
    beforeOperation: [firstUserGate],
    beforeChange: [firstUserIsAdmin],
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      saveToJWT: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      access: { create: isAdminField, update: isAdminField },
    },
  ],
}

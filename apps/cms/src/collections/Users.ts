import type { CollectionAfterLogoutHook, CollectionConfig } from 'payload'

import { adminOrSelf, isAdmin, isAdminField, isStaff, selfOrAdmin } from '../lib/access'
import { lumenStrategy } from '../lib/lumen/strategy'

// Sign-out from Payload's own endpoint (/api/users/logout, which the admin
// calls on inactivity) ends the Lumen session too, so the cookie cannot sign
// the person straight back in.
const endLumenSession: CollectionAfterLogoutHook = async ({ req }) => {
  const [{ lumenTransport }, { endSession }] = await Promise.all([import('../lib/lumen/transport'), import('../lib/lumen/logout')])
  const secure = new URL(req.url ?? 'https://cms.invalid').protocol === 'https:'
  const { setCookie } = await endSession(await lumenTransport(), req.headers, secure)
  req.responseHeaders ??= new Headers()
  req.responseHeaders.append('set-cookie', setCookie)
}

// Staff accounts (multi-tenant-saas-2-console design §2–§3). Staff sign in
// with their Lumen account; there are no Payload passwords for staff.
// Learners are a different collection with their own sign-in and are not
// touched. A row is created on first sign-in and linked by lumenUserId. No
// role means pending: signed in but not let into the admin. An admin can also
// add a row by email beforehand, with a role, as an invitation: it is linked
// when that email signs in.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // enableFields keeps the auth columns (email, sessions, ...) so the
    // schema stays as migration 200 made it; only the password flows go.
    disableLocalStrategy: { enableFields: true },
    strategies: [lumenStrategy],
  },
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'name', 'role', 'lumenUserId'] },
  access: {
    admin: isStaff,
    read: selfOrAdmin,
    create: isAdmin,
    update: adminOrSelf,
    delete: isAdmin,
  },
  hooks: { afterLogout: [endLumenSession] },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      saveToJWT: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor (site pages and posts)', value: 'editor' },
        { label: 'Instructor (courses in their academies)', value: 'instructor' },
      ],
      admin: { description: 'Empty means pending: signed in with Lumen, but not let into the admin yet.' },
      access: { create: isAdminField, update: isAdminField },
    },
    {
      // The academies an instructor manages. Only admins assign them.
      name: 'tenants',
      label: 'Academies',
      type: 'relationship',
      relationTo: 'tenants',
      hasMany: true,
      saveToJWT: true,
      access: { create: isAdminField, update: isAdminField },
      admin: { condition: (data) => data?.role === 'instructor' },
    },
    {
      name: 'lumenUserId',
      label: 'Lumen user',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar', description: 'Set on first Lumen sign-in.' },
      access: { create: () => false, update: () => false },
    },
  ],
}

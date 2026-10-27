import type { CollectionConfig } from 'payload'

import { isAdmin } from '../../lib/access'
import { canCreateInTenant, enforceTenantScope, publishedOrTenantStaff, tenantStaff } from '../../lib/lms-access'
import { slugField } from '../../lib/slug'

export const Courses: CollectionConfig = {
  slug: 'courses',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'tenant', 'level', '_status', 'updatedAt'], group: 'Learning' },
  versions: { drafts: true, maxPerDoc: 25 },
  access: {
    read: publishedOrTenantStaff({ _status: { equals: 'published' } }),
    create: canCreateInTenant,
    update: tenantStaff,
    delete: isAdmin,
  },
  // A course's slug is unique within its academy: /courses/<academy>/<course>.
  indexes: [{ fields: ['tenant', 'slug'], unique: true }],
  hooks: { beforeChange: [enforceTenantScope] },
  fields: [
    { name: 'tenant', label: 'Academy', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { position: 'sidebar' } },
    { name: 'title', type: 'text', required: true },
    slugField('title', { unique: false }),
    { name: 'summary', type: 'textarea' },
    {
      name: 'level',
      type: 'select',
      defaultValue: 'beginner',
      options: [
        { label: 'Beginner', value: 'beginner' },
        { label: 'Intermediate', value: 'intermediate' },
        { label: 'Advanced', value: 'advanced' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'coverUrl', label: 'Cover image URL', type: 'text' },
    {
      name: 'instructor',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
      filterOptions: { role: { equals: 'instructor' } },
    },
  ],
}

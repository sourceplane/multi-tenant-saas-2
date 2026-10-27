import type { CollectionConfig } from 'payload'

import { canCreateInTenant, enforceTenantScope, publishedOrTenantStaff, tenantFromCourse, tenantStaff, tenantStaffField } from '../../lib/lms-access'
import { slugField } from '../../lib/slug'

// A lesson is listed wherever its course is published; its body and video are
// for the academy's staff here, and for enrolled learners once learner
// records exist.
export const Lessons: CollectionConfig = {
  slug: 'lessons',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'course', 'order', 'minutes'], group: 'Learning' },
  defaultSort: 'order',
  access: {
    read: publishedOrTenantStaff({ 'course._status': { equals: 'published' } }),
    create: canCreateInTenant,
    update: tenantStaff,
    delete: tenantStaff,
  },
  indexes: [{ fields: ['course', 'slug'], unique: true }],
  hooks: { beforeValidate: [tenantFromCourse], beforeChange: [enforceTenantScope] },
  fields: [
    { name: 'course', type: 'relationship', relationTo: 'courses', required: true, index: true },
    {
      name: 'tenant',
      label: 'Academy',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      admin: { readOnly: true, position: 'sidebar', description: "Set from the course's academy." },
    },
    { name: 'order', type: 'number', required: true, defaultValue: 1, min: 1, admin: { position: 'sidebar' } },
    { name: 'title', type: 'text', required: true },
    slugField('title', { unique: false }),
    { name: 'minutes', type: 'number', min: 1, admin: { position: 'sidebar' } },
    { name: 'videoUrl', label: 'Video URL', type: 'text', access: { read: tenantStaffField } },
    { name: 'content', type: 'richText', access: { read: tenantStaffField } },
  ],
}

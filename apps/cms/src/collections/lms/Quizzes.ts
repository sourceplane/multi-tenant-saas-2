import type { CollectionConfig } from 'payload'

import { canCreateInTenant, enforceTenantScope, publishedOrTenantStaff, tenantFromCourse, tenantStaff, tenantStaffField } from '../../lib/lms-access'
import { slugField } from '../../lib/slug'

type Question = { options?: unknown[] | null; correctIndex?: number | null }

// The answer key (`correctIndex`) is readable by the academy's staff only, so
// no API, GraphQL query or page can hand it to a learner. Scoring happens on
// the server.
export const Quizzes: CollectionConfig = {
  slug: 'quizzes',
  labels: { singular: 'Quiz', plural: 'Quizzes' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'course', 'passingScore'], group: 'Learning' },
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
    { name: 'title', type: 'text', required: true },
    slugField('title', { unique: false }),
    {
      name: 'passingScore',
      label: 'Passing score (%)',
      type: 'number',
      required: true,
      defaultValue: 70,
      min: 0,
      max: 100,
      admin: { position: 'sidebar' },
    },
    {
      name: 'questions',
      type: 'array',
      required: true,
      minRows: 1,
      access: { read: tenantStaffField },
      fields: [
        { name: 'prompt', type: 'text', required: true },
        { name: 'options', type: 'array', required: true, minRows: 2, fields: [{ name: 'label', type: 'text', required: true }] },
        {
          name: 'correctIndex',
          label: 'Correct option (0 = first)',
          type: 'number',
          required: true,
          min: 0,
          access: { read: tenantStaffField },
          admin: { description: 'Zero-based: 0 is the first option.' },
          validate: (value: number | null | undefined, { siblingData }: { siblingData: Question }) => {
            const count = Array.isArray(siblingData?.options) ? siblingData.options.length : 0
            if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= count) {
              return `Pick one of the ${count} options (0 to ${Math.max(count - 1, 0)}).`
            }
            return true
          },
        },
      ],
    },
  ],
}

import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../../lib/access'
import { slugField } from '../../lib/slug'

// An academy: the tenant every course, lesson, quiz and learner record
// belongs to. Admins create academies and assign instructors to them.
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  labels: { singular: 'Academy', plural: 'Academies' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'enrolment'], group: 'Learning' },
  access: { read: anyone, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'description', type: 'textarea' },
    {
      name: 'enrolment',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Open: any learner can enrol', value: 'open' },
        { label: 'Closed: no new enrolments', value: 'closed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      // The operator's Lumen organization, for billing. Recorded, not enforced.
      name: 'lumenOrgId',
      type: 'text',
      admin: { position: 'sidebar', description: 'Lumen organization id, for the operator. Optional.' },
      access: { read: ({ req: { user } }) => Boolean(user && (user as { collection?: string }).collection !== 'learners') },
    },
  ],
}

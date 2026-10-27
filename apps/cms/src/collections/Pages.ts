import type { CollectionConfig } from 'payload'

import { isAdmin, isStaff, publishedOrStaff } from '../lib/access'
import { slugField } from '../lib/slug'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'] },
  versions: { drafts: true, maxPerDoc: 25 },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isAdmin },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    { name: 'content', type: 'richText' },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
  ],
}

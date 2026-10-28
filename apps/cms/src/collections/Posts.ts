import type { CollectionConfig } from 'payload'

import { isAdmin, isStaff, publishedOrStaff } from '../lib/access'
import { slugField } from '../lib/slug'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'category', '_status', 'publishedAt'] },
  versions: { drafts: true, maxPerDoc: 25 },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isAdmin },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    { name: 'excerpt', type: 'textarea' },
    { name: 'content', type: 'richText' },
    { name: 'category', type: 'relationship', relationTo: 'categories' },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
  ],
}

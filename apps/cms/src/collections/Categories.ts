import type { CollectionConfig } from 'payload'

import { anyone, isAdmin, isStaff } from '../lib/access'
import { slugField } from '../lib/slug'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'name' },
  access: { read: anyone, create: isStaff, update: isStaff, delete: isAdmin },
  fields: [{ name: 'name', type: 'text', required: true }, slugField('name')],
}

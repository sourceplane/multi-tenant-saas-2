import type { Field, FieldHook } from 'payload'

export const toSlug = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // combining marks left by NFKD
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)

const fromField =
  (source: string): FieldHook =>
  ({ value, data }) => {
    if (typeof value === 'string' && value.length > 0) return toSlug(value)
    const fallback = data?.[source]
    return typeof fallback === 'string' ? toSlug(fallback) : value
  }

/** A unique, indexed slug derived from `source` unless an editor sets one. */
export const slugField = (source = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: { position: 'sidebar', description: `Derived from the ${source} unless you set it.` },
  hooks: { beforeValidate: [fromField(source)] },
})

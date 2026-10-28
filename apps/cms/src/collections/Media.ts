import { APIError, type Access, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { anyone, isAdmin, roleOf, type StaffUser } from '../lib/access'
import { tenantIdsOf } from '../lib/lms-access'

/**
 * What an upload may be. Raster images and PDFs only: no SVG, because an SVG
 * served from the CMS's own origin can carry script, and the admin lives on
 * that origin.
 */
export const MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'application/pdf']

/** Largest upload accepted, in bytes (enforced by Payload's body parser). */
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024

/**
 * The root config's `upload` options. abortOnLimit matters: without it the
 * parser stops reading at the limit and Payload stores the file truncated.
 * With it, an upload over the limit is refused (413) and nothing is stored.
 */
export const MEDIA_UPLOAD_OPTIONS = {
  limits: { fileSize: MEDIA_MAX_BYTES },
  abortOnLimit: true,
  responseOnLimit: 'Files are limited to 10 MiB.',
}

// Media is the lumen-payload-cms layer's PC4 collection, scoped to academies
// like the rest of the learning domain. A file either belongs to the site
// (no academy: pages and posts, managed by editors) or to one academy
// (managed by that academy's instructors). Admins manage all of it. Files are
// public by URL, like the cover and video URLs courses already carry: put
// nothing here that only enrolled learners may see.

type Rel = string | { id: string } | null | undefined
const idOf = (rel: Rel): string | undefined => (!rel ? undefined : typeof rel === 'string' ? rel : rel.id)

/** Upload: admins; editors (site media); instructors who have an academy (its media). */
export const canCreateMedia: Access = ({ req: { user } }) => {
  const u = user as StaffUser
  const role = roleOf(u)
  return role === 'admin' || role === 'editor' || (role === 'instructor' && tenantIdsOf(u).length > 0)
}

/** Edit or replace: admins all; editors the site's media; instructors their academies' media. */
export const canUpdateMedia: Access = ({ req: { user } }) => {
  const u = user as StaffUser
  const role = roleOf(u)
  if (role === 'admin') return true
  if (role === 'editor') return { tenant: { exists: false } }
  if (role === 'instructor') return { tenant: { in: tenantIdsOf(u) } }
  return false
}

/**
 * Where a file lands follows who uploads it, checked against what is written
 * (never trusted from the form): an editor's media has no academy, an
 * instructor's belongs to one of theirs. Neither can move a file elsewhere.
 */
export const enforceMediaScope: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const u = req.user as StaffUser
  const role = roleOf(u)
  if (!u || role === 'admin') return data
  const raw = data && 'tenant' in data ? data.tenant : originalDoc?.tenant
  const tenant = idOf(raw as Rel)
  if (role === 'editor' && !tenant) return data
  if (role === 'instructor' && tenant && tenantIdsOf(u).includes(tenant)) return data
  throw new APIError(
    role === 'editor'
      ? "Editors manage the site's media, which belongs to no academy."
      : 'You can only add media to your own academies.',
    403,
    undefined,
    true,
  )
}

// Images and documents for pages, posts and lessons, stored in the CMS's R2
// bucket (R2_MEDIA, infra/terraform/cloudflare-r2-cms) by
// @payloadcms/storage-r2 and served back by Payload at
// /api/media/file/<filename>. Readable by anyone, like the published content
// that embeds them.
export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'alt', defaultColumns: ['filename', 'alt', 'tenant', 'mimeType', 'filesize'] },
  access: { read: anyone, create: canCreateMedia, update: canUpdateMedia, delete: isAdmin },
  hooks: { beforeChange: [enforceMediaScope] },
  upload: {
    mimeTypes: MEDIA_MIME_TYPES,
    // workerd has no sharp: no resizing, cropping or focal point. A file is
    // stored and served as uploaded.
    crop: false,
    focalPoint: false,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Describes the image for people who cannot see it.' },
    },
    {
      name: 'tenant',
      label: 'Academy',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      admin: {
        position: 'sidebar',
        description: "The academy this file belongs to. Leave it empty for the site's own media (pages and posts).",
      },
    },
  ],
}

import {
  canCreateMedia,
  canUpdateMedia,
  enforceMediaScope,
  Media,
  MEDIA_MAX_BYTES,
  MEDIA_MIME_TYPES,
  MEDIA_UPLOAD_OPTIONS,
} from '@cms/collections/Media'
import { MISSING_MEDIA_BUCKET_MESSAGE, mediaBucketFrom, missingMediaBucket } from '@cms/lib/media-bucket'

import { APIError } from './stubs/payload'

// Media (the lumen-payload-cms layer's PC4, ported by LMS6): uploads in the
// CMS's R2 bucket, served back by Payload. What may be uploaded, who may do
// what in which academy, and what happens when the Worker has no bucket.

type Fn = (args: Record<string, unknown>) => unknown
const run = (fn: unknown, args: Record<string, unknown>) => (fn as Fn)(args)
const withUser = (user: unknown) => ({ req: { user } })

const anon = null
const admin = { id: 'a', collection: 'users', role: 'admin' }
const editor = { id: 'e', collection: 'users', role: 'editor' }
const instructor = { id: 'i', collection: 'users', role: 'instructor', tenants: ['t1', { id: 't2' }] }
const unassigned = { id: 'u', collection: 'users', role: 'instructor', tenants: [] }
const learner = { id: 'l', collection: 'learners' }

describe('media collection', () => {
  it('is an upload collection named media', () => {
    expect(Media.slug).toBe('media')
    expect(Media.upload).toBeTruthy()
  })

  it('anyone reads media, like the published content that embeds it', () => {
    expect(run(Media.access!.read, withUser(anon))).toBe(true)
  })

  it('accepts raster images and PDFs, never SVG (script on the admin origin)', () => {
    const upload = Media.upload as { mimeTypes: string[] }
    expect(upload.mimeTypes).toEqual(MEDIA_MIME_TYPES)
    expect(MEDIA_MIME_TYPES).toEqual(expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']))
    expect(MEDIA_MIME_TYPES.some((t) => t.includes('svg') || t.endsWith('/*'))).toBe(false)
  })

  it('stores files as uploaded: no resizing on workerd (no sharp)', () => {
    const upload = Media.upload as { crop?: boolean; focalPoint?: boolean; imageSizes?: unknown[] }
    expect(upload.crop).toBe(false)
    expect(upload.focalPoint).toBe(false)
    expect(upload.imageSizes).toBeUndefined()
  })

  it('requires alt text, and the academy is optional (empty is the site)', () => {
    const field = (name: string) => Media.fields.find((f) => 'name' in f && f.name === name) as Record<string, unknown> | undefined
    expect(field('alt')?.required).toBe(true)
    expect(field('tenant')).toMatchObject({ type: 'relationship', relationTo: 'tenants', index: true })
    expect(field('tenant')?.required).toBeUndefined()
  })

  it('refuses an upload over 10 MiB instead of storing it truncated', () => {
    expect(MEDIA_MAX_BYTES).toBe(10 * 1024 * 1024)
    expect(MEDIA_UPLOAD_OPTIONS.limits.fileSize).toBe(MEDIA_MAX_BYTES)
    expect(MEDIA_UPLOAD_OPTIONS.abortOnLimit).toBe(true)
  })
})

describe('who may upload, change and delete', () => {
  it('uploads: admins, editors and instructors with an academy; nobody else', () => {
    expect(run(canCreateMedia, withUser(admin))).toBe(true)
    expect(run(canCreateMedia, withUser(editor))).toBe(true)
    expect(run(canCreateMedia, withUser(instructor))).toBe(true)
    expect(run(canCreateMedia, withUser(unassigned))).toBe(false)
    expect(run(canCreateMedia, withUser(learner))).toBe(false)
    expect(run(canCreateMedia, withUser(anon))).toBe(false)
    expect(Media.access!.create).toBe(canCreateMedia)
  })

  it("changes: admins all, editors the site's media, instructors their academies' media", () => {
    expect(run(canUpdateMedia, withUser(admin))).toBe(true)
    expect(run(canUpdateMedia, withUser(editor))).toEqual({ tenant: { exists: false } })
    expect(run(canUpdateMedia, withUser(instructor))).toEqual({ tenant: { in: ['t1', 't2'] } })
    expect(run(canUpdateMedia, withUser(learner))).toBe(false)
    expect(run(canUpdateMedia, withUser(anon))).toBe(false)
    expect(Media.access!.update).toBe(canUpdateMedia)
  })

  it('deletes: admins only', () => {
    expect(run(Media.access!.delete, withUser(admin))).toBe(true)
    expect(run(Media.access!.delete, withUser(editor))).toBe(false)
    expect(run(Media.access!.delete, withUser(instructor))).toBe(false)
  })
})

describe('enforceMediaScope', () => {
  const scope = (user: unknown, data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
    run(enforceMediaScope, { data, originalDoc, req: { user } })

  it('runs on every write', () => {
    expect(Media.hooks?.beforeChange).toContain(enforceMediaScope)
  })

  it('lets admins put a file anywhere', () => {
    expect(scope(admin, { alt: 'x', tenant: 't9' })).toEqual({ alt: 'x', tenant: 't9' })
    expect(scope(admin, { alt: 'x' })).toEqual({ alt: 'x' })
  })

  it("keeps an editor's media on the site", () => {
    expect(scope(editor, { alt: 'x' })).toEqual({ alt: 'x' })
    expect(scope(editor, { alt: 'x', tenant: null })).toEqual({ alt: 'x', tenant: null })
    expect(() => scope(editor, { alt: 'x', tenant: 't1' })).toThrow(APIError)
    expect(() => scope(editor, { alt: 'y' }, { tenant: 't1' })).toThrow(APIError)
  })

  it("keeps an instructor's media in their own academies", () => {
    expect(scope(instructor, { alt: 'x', tenant: 't1' })).toEqual({ alt: 'x', tenant: 't1' })
    expect(scope(instructor, { alt: 'y' }, { tenant: { id: 't2' } })).toEqual({ alt: 'y' })
    expect(() => scope(instructor, { alt: 'x' })).toThrow(APIError)
    expect(() => scope(instructor, { alt: 'x', tenant: 't9' })).toThrow(APIError)
    expect(() => scope(instructor, { tenant: 't9' }, { tenant: 't1' })).toThrow(APIError)
    expect(() => scope(instructor, { tenant: null }, { tenant: 't1' })).toThrow(APIError)
  })
})

describe('media bucket', () => {
  it('is the R2_MEDIA binding when the Worker has one', () => {
    const bucket = { put: () => 'stored' }
    expect(mediaBucketFrom({ R2_MEDIA: bucket })).toBe(bucket)
  })

  it('without the binding, every call fails naming it', () => {
    const bucket = mediaBucketFrom<{ put: () => unknown; get: () => unknown }>(undefined)
    expect(() => bucket.put()).toThrow(MISSING_MEDIA_BUCKET_MESSAGE)
    expect(() => bucket.get()).toThrow(MISSING_MEDIA_BUCKET_MESSAGE)
    expect(() => missingMediaBucket<{ head: () => unknown }>().head()).toThrow(/R2_MEDIA binding is missing/)
  })
})

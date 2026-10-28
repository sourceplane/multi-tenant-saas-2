// The media bucket for @payloadcms/storage-r2. On Workers it is the R2_MEDIA
// binding (infra/terraform/cloudflare-r2-cms). A Worker deployed without the
// binding still starts, and every upload or file read fails with a message that
// names the binding, instead of Payload falling back to a local disk the
// Worker does not have.

export const MISSING_MEDIA_BUCKET_MESSAGE =
  'R2_MEDIA binding is missing: this Worker has no media bucket (infra/terraform/cloudflare-r2-cms).'

/** A stand-in with the bucket's shape whose every call fails loudly. */
export function missingMediaBucket<B extends object>(): B {
  const fail = (): never => {
    throw new Error(MISSING_MEDIA_BUCKET_MESSAGE)
  }
  return new Proxy({} as B, { get: () => fail })
}

/** The bucket to hand the storage adapter: the binding, or the loud stand-in. */
export function mediaBucketFrom<B extends object>(env: { R2_MEDIA?: B } | undefined): B {
  return env?.R2_MEDIA ?? missingMediaBucket<B>()
}

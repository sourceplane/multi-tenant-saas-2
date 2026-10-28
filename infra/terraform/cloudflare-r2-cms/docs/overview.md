# cloudflare-r2-cms

The CMS's private media bucket per environment, on Cloudflare R2.

Manages, for `stage` and `prod` (`dev` is verify-only and provisions nothing):

- **`<prefix>multi-tenant-saas-2-cms-media-<env>`**, a private R2 bucket: `stg-multi-tenant-saas-2-cms-media-stage` and `prod-multi-tenant-saas-2-cms-media-prod` (the environment's `namespacePrefix` comes first). Nothing reads it
  directly: the CMS Worker binds it as `R2_MEDIA`, Payload writes uploads to it,
  and Payload serves them back through its own access rules at
  `/api/media/file/<filename>`.

## Why its own token

The fleet's brokered `workers-deploy` token covers Workers scripts and KV, not
R2, so no existing credential can create a bucket. This component runs with
`CLOUDFLARE_R2_TOKEN`, minted once from the Cloudflare connection's `r2-data`
template (Workers R2 Storage Write) on this project and rotated by the
platform every 30 days. The Worker itself needs no token: its binding is the
access.

## Depends on

Nothing: the bucket stands alone.

## Depended on by

- **cms**: the Payload CMS Worker (`apps/cms`) binds this bucket as `R2_MEDIA`
  for its `media` collection.

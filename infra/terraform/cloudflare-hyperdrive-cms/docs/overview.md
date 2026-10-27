# cloudflare-hyperdrive-cms

The CMS's own Hyperdrive config per environment, with query caching disabled, and the CMS's generated Payload secret.

Manages, for `stage` and `prod` (`dev` is verify-only and provisions nothing):

- **`multi-tenant-saas-2-cms-<env>`**, a Hyperdrive config over the same Supabase
  origin as `cloudflare-hyperdrive`, with **caching disabled**.
- **Payload's secret**, generated here and never typed or shown to anyone.

## Why a second config

Hyperdrive does not invalidate a cached read when the application writes
(default `max_age` 60 s). The fleet's workers tolerate that. An editor who
saves a page and reloads it would not: they would see the old page for up to a
minute. Cloudflare's guidance for reads that must be fresh is a second,
cache-disabled config, which is what this is. Nothing about the fleet's config
changes.

## Depends on

- **supabase**: publishes the origin (project ref, database password).

## Depended on by

- **cms**: the Payload CMS Worker (`apps/cms`) binds this config as
  `HYPERDRIVE_CMS` and runs with this Payload secret.

# cms

Payload CMS on Cloudflare Workers: the admin panel at `/admin`, the REST API
at `/api/<collection>` and GraphQL at `/api/graphql`, over Postgres schema
`cms`, deployed beside the fleet as `multi-tenant-saas-2-cms-<env>`.

| | stage | prod |
|---|---|---|
| URL | https://multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev | https://multi-tenant-saas-2-cms-prod.nexo-7be.workers.dev |

## What it holds

- **users**: staff accounts (`admin`, `editor`). The first account is created
  through the setup gate and is an admin; admins create the rest.
- **pages** and **posts**: drafts, versions (25 per document), a Lexical
  rich-text body and a unique slug. Posts have an excerpt and a category.
- **categories**: name and slug.

Published pages, posts and categories are readable by anyone through the API.
Drafts, accounts and everything else need a staff session.

## Depends on

- **cloudflare-hyperdrive-cms**: its database path (cache disabled) and its
  generated Payload secret.
- **db-migrate**: applies schema `cms` (migration `200_cms_payload_core`)
  before the CMS deploys.

Nothing in the fleet calls the CMS, and the CMS calls nothing in the fleet.

## Verified by

- **cms-tests** on every pull request that touches it.
- The deploy's smoke check on stage and prod: `/health` reports the database
  `ok`, and `/admin` answers 200.

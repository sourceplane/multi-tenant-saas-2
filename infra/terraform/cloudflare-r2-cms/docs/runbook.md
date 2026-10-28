# cloudflare-r2-cms — runbook

## How it deploys

Merges to `main` converge automatically: CI plans changed components
(`orun plan --changed`) and applies this component on stage, then prod. Pull
requests only plan.

## Verify

```bash
# published outputs (names only, per environment)
orun secrets list --org <ws> --env stage   # WIRING_CLOUDFLARE_R2_CMS
wrangler r2 bucket list                    # stg-multi-tenant-saas-2-cms-media-stage, prod-multi-tenant-saas-2-cms-media-prod
```

## The token

`CLOUDFLARE_R2_TOKEN` lives on this project's rung, minted from the Cloudflare
connection's `r2-data` template and rotated by the platform every 30 days:

```bash
orun secrets list --org <ws> --project      # CLOUDFLARE_R2_TOKEN, its rotation and expiry
# to re-create it (no value is read or shown):
orun integrations cloudflare secret create CLOUDFLARE_R2_TOKEN \
  --connection <int_…> --template r2-data --mode rotated --project
```

## Common failures

- **"Please enable R2 through the Cloudflare Dashboard. (10042)"**: R2 has
  never been enabled on the Cloudflare account. The account owner enables it
  once in the dashboard (R2 Object Storage), then re-run the failed lanes.

- **Provider auth failure (403 on the bucket)**: the token is missing,
  expired or revoked. Re-create it as above; nothing else changes.
- **"Resource already exists" with empty platform state**: adoption imports the
  bucket at plan time.
- **Deleting the bucket**: R2 refuses to delete a bucket that still holds
  objects, and a destroy here would take every uploaded file with it. Remove
  the component only after the CMS's `media` collection is gone.

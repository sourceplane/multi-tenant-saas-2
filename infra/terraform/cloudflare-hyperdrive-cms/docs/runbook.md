# cloudflare-hyperdrive-cms — runbook

## How it deploys

Merges to `main` converge automatically: CI plans changed components
(`orun plan --changed`) and applies this component on stage, then prod. Pull
requests only plan.

## Verify

```bash
# published outputs (names only, per environment)
orun secrets list --org <ws> --env stage   # WIRING_CLOUDFLARE_HYPERDRIVE_CMS, CMS_PAYLOAD_SECRET
wrangler hyperdrive list                   # multi-tenant-saas-2-cms-stage, caching disabled
```

## Rotating the Payload secret

Land a pull request that adds (or changes) `keepers = { rotated = "<date>" }`
on `random_password.payload_secret`. The apply on `main` generates a new value
and publishes it; the next `cms` deploy pushes it to the Worker. Every staff
session ends and staff sign in again; content is unaffected.

## Common failures

- **"Resource already exists" with empty platform state**: adoption imports the
  Hyperdrive config at plan time. The Payload secret has no adoption: lost state
  generates a new one, which only signs staff out.
- **Provider auth failure**: the Cloudflare integration connection is missing
  or revoked. Reconnect it in the console; tokens are brokered per run.
- **Origin unreachable after a Supabase password change**: re-apply; the origin
  password comes from `SUPABASE_DB_PASSWORD` on every apply.

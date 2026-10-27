# admin-worker

Internal Cloudflare Worker for audited support/administration diagnostics

Part of the multi-tenant-saas-2 runtime: a Cloudflare Worker deployed per
environment (`stage`, `prod`; `dev` is verify-only). Not publicly routable — reached only through `api-edge` service bindings.

## Depends on

- **cloudflare-hyperdrive** — Provisions Cloudflare Hyperdrive resources for stage and prod Supabase Postgres databases

## Depended on by

- (none)

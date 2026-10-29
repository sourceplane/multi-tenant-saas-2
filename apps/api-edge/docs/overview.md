# api-edge

Cloudflare Worker for the API edge Runtime

Part of the multi-tenant-saas-2 runtime: a Cloudflare Worker deployed per
environment (`stage`, `prod`; `dev` is verify-only). Public entry point: `https://multi-tenant-saas-2-api-edge-{stage,prod}.nexo-7be.workers.dev`

## Depends on

- **billing-worker** — Cloudflare Worker for the Billing API surface (private, service-binding only)
- **cloudflare-hyperdrive** — Provisions Cloudflare Hyperdrive resources for stage and prod Supabase Postgres databases
- **cloudflare-kv** — Provisions Cloudflare KV namespaces backing the api-edge idempotency replay store (stage and prod)
- **config-worker** — Cloudflare Worker for the Config read-only API surface
- **events-worker** — Cloudflare Worker for the Events and Audit runtime
- **identity-worker** — Cloudflare Worker for the Identity auth runtime
- **integrations-worker** — Cloudflare Worker for the integrations bounded context — provider connections (GitHub App first), inbound delivery inbox, repo links, and the installation-token broker
- **membership-worker** — Cloudflare Worker for the Membership org runtime
- **metering-worker** — Cloudflare Worker for the Metering API surface (usage recording, quota checks)
- **notifications-worker** — Cloudflare Worker for the Notifications bounded context
- **projects-worker** — Cloudflare Worker for the Projects runtime
- **webhooks-worker** — Cloudflare Worker for webhook endpoint, subscription, and delivery-attempt management

## Depended on by

- **cms** — the learning platform and staff console (Payload CMS on Workers): asks the edge, over its `LUMEN_API` service binding, for the staff's Lumen sessions and the account pages' data

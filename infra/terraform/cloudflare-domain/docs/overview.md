# cloudflare-domain

Manages the Cloudflare zone and attaches custom domains to environment-specific Worker services (cms)

Manages DNS records and Worker routes/custom domains on the product zone for multi-tenant-saas-2, per environment (`stage`, `prod`; `dev` is
verify-only and provisions nothing).

## Depends on

- **cms** — the learning platform and staff console (Payload CMS on Workers), which the parked domain would serve

## Depended on by

- (none)

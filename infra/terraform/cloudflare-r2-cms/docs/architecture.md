# cloudflare-r2-cms — architecture

A `terraform` component rooted at `infra/terraform/cloudflare-r2-cms/terraform`.

- **Resources**: `cloudflare_r2_bucket.media`, private, with no public access
  and no custom domain.
- **State** lives in the platform's HTTP state backend (run-token auth).
- **Credentials**: `CLOUDFLARE_R2_TOKEN` (from the `r2-data` template, rotated
  by the platform) as the provider's `CLOUDFLARE_API_TOKEN`, and the brokered
  account id.
- **Outputs are published as job-output secrets** on each environment rung:
  `WIRING_CLOUDFLARE_R2_CMS`, `{bucket_name}`. `apps/cms` reads it as
  `WIRING_CLOUDFLARE_R2_CMS_<ENV>` and renders its `R2_MEDIA` binding from it
  at deploy time.
- **Self-healing adoption** (`adopt.tf`): with empty platform state and an
  existing bucket of the same name, plan-time import adopts it instead of
  failing with "already exists". A bucket's name is its id, so the lookup is
  one `GET /accounts/<id>/r2/buckets/<name>`.

Land this component on its own, before the CMS binds it: the CMS's wrangler
config names both environments' buckets, and `dependsOn` only orders within
one environment (risk LMS-J, `specs/epics/multi-tenant-saas-2-lms`).

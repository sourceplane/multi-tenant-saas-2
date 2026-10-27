# cloudflare-hyperdrive-cms — architecture

A `terraform` component rooted at `infra/terraform/cloudflare-hyperdrive-cms/terraform`.

- **Resources**: `cloudflare_hyperdrive_config.cms` (caching disabled) and
  `random_password.payload_secret` (48 characters, alphanumeric).
- **State** lives in the platform's HTTP state backend (run-token auth).
- **Credentials are brokered per run**: the Hyperdrive-edit token and account
  id, plus the Supabase origin the `supabase` component published. Same
  credentials as `cloudflare-hyperdrive`.
- **Outputs are published as job-output secrets** on each environment rung:
  - `WIRING_CLOUDFLARE_HYPERDRIVE_CMS`: `{hyperdrive_id, hyperdrive_name}`.
    `apps/cms` reads it as `WIRING_CLOUDFLARE_HYPERDRIVE_CMS_<ENV>` and
    renders its `HYPERDRIVE_CMS` binding from it at deploy time.
  - `CMS_PAYLOAD_SECRET`: the Payload secret. `apps/cms` resolves it as
    `PAYLOAD_SECRET`, and its deploy pushes it to the Worker with
    `wrangler secret bulk`. Its value never reaches a log.
- **Self-healing adoption** (`adopt.tf`): with empty platform state and an
  existing config of the same name, plan-time import adopts it instead of
  failing with "already exists".

Account limit: 25 Hyperdrive configs per account (Workers Paid). This product
uses four (fleet and CMS, stage and prod).

# cms-tests

Verification suite for `cms` (the Payload CMS Worker, `apps/cms`).

A verify-only component, and nothing deploys from here. The suite runs on every
pull request that changes it (this component's lane) and on every lane of the
`cms` component, whose build runs it: a change to the CMS alone does not mark
this component changed. A red suite blocks the merge.

## What it proves

| Suite | The promise |
|---|---|
| `setup-gate` | First-user setup is closed unless the owner set a long-enough `CMS_SETUP_TOKEN` and the request presents exactly it. |
| `users-gate` | `/api/users/first-register` is refused with 403 until then; the first account becomes an admin; the gate never touches later accounts or other operations. |
| `access` | Published pages, posts and categories are public; drafts and everything else need staff; only admins delete or manage accounts; an editor cannot change a role. |
| `request-scoped-pool` | Every query and transaction opens its own Postgres client and closes it, so no request awaits a socket another request opened (workerd forbids that). |
| `wrangler-config` | The rendered config deploys the OpenNext build, binds `HYPERDRIVE_CMS` per environment from wiring, and commits no ids or secrets. |
| `migration-sync` | `packages/db` migration 200 is byte for byte the converter's output for Payload's migration. |
| `runtime` | The Worker reads its binding; `next build` and the CLIs read `DATABASE_URL`. |
| `slug` | Slugs are derived, normalised and capped. |

## Gates

- `pnpm exec turbo run build --filter=./`: typecheck, then the suite (the
  package's `build` script runs both).

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
| `users` | No CMS passwords (the local strategy is off, `lumen` is the strategy); a role is optional and no role means pending; `lumenUserId` is unique and no request sets it; a pending account reads only itself. |
| `lumen-strategy` | Only a live Lumen session in the cookie signs anyone in, never a background request from another site; the token is never on the user; the first admin needs the setup cookie; sign-out revokes the session and clears the cookie. |
| `lumen-accounts` | A Lumen user is found by link, linked once by email (an invitation keeps its role) or created pending; nobody becomes admin without setup while no admin exists; a create race reads the row back. |
| `lumen-session` | api-edge is asked with the bearer token; answers are remembered 30 s per token; concurrent requests share one lookup; a confirmed session survives api-edge being unable to answer for up to 5 minutes (until it expires), and anything else fails closed. |
| `lumen-account-api` | The account pages call api-edge's own routes with the person's token; the security-events cursor goes back as given; a requested organization is used only if it is the person's. |
| `lumen-forms` | The account forms accept only same-origin posts from staff (a pending account goes to the pending page), save at Lumen with the person's session, copy the display name onto the `users` row, save every email category, and report Lumen's refusals. |
| `lumen-billing` | Billing & plan's form starts checkout with the CMS as the return and sends the browser only to an https provider page; plan changes, cancellations and reconciles come back to the page; refusals are reported; odd input calls nothing. |
| `lumen-model-*` | The console's profile, notification-preference, security-event and plan models, copied with their tests. |
| `lumen-cookies` | The session cookie is HttpOnly, Lax, at most 30 days; a redirect never leaves `/admin`; the origin checks refuse other sites. |
| `access` | Published pages, posts and categories are public; drafts and everything else need staff; only admins delete or manage accounts; an editor cannot change a role. |
| `request-scoped-pool` | Every query and transaction opens its own Postgres client and closes it, so no request awaits a socket another request opened (workerd forbids that). |
| `wrangler-config` | The rendered config deploys the OpenNext build, binds `HYPERDRIVE_CMS` per environment from wiring, and commits no ids or secrets. |
| `migration-sync` | Each converted `packages/db` migration (200, 205, 206) is byte for byte the converter's output for its Payload migration. |
| `runtime` | The Worker reads its binding; `next build` and the CLIs read `DATABASE_URL`. |
| `slug` | Slugs are derived, normalised and capped. |

## Gates

- `pnpm exec turbo run build --filter=./`: typecheck, then the suite (the
  package's `build` script runs both).

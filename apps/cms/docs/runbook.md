# cms — runbook

## How it deploys

A merge to `main` that changes `apps/cms` deploys stage, then prod, in the
CMS's own lane, after `cloudflare-hyperdrive-cms` and `db-migrate` for that
environment. The lane builds, renders the wrangler config from the published
wiring, runs `wrangler deploy`, pushes the runtime secrets, and smoke-checks
`/health` and `/admin` (retried for about 4.5 minutes). Pull requests build,
typecheck and dry-run the deploy; nothing deploys from a pull request.

## Sign in

The admin has no passwords of its own. `/admin` shows a Lumen sign-in: an
emailed code, or GitHub or Google where the identity plane has them
configured. The sign-in runs against `api-edge` from the browser; the Lumen
session it returns goes to `/auth/lumen/session`, which puts it in an
HttpOnly `lumen_session` cookie on the CMS host and never shows it to page
scripts. Each request, the `lumen` auth strategy (`src/lib/lumen/`) asks
`api-edge` who the cookie belongs to (cached 30 s) and maps the Lumen user to
a `users` row by `lumenUserId`, creating the row the first time. This is for
**staff** only: learners are a separate collection and keep signing in to the
academy (`/login`, `/register`) with their own email and password.

A new row has **no role**, which means *pending*: the person is signed in but
sees "Waiting for access" until an admin opens *Users* and makes them an
`editor`, `instructor` (with the academies they teach) or `admin`. A row an admin created beforehand with the same email
(an invitation) is linked on that person's first sign-in and keeps its role.
Signing out (the admin's log-out button) revokes the Lumen session too.

## Your account

The admin's nav has an **Account** group: the same Lumen account pages the
console had, for every staff role (a pending account sees none of them). Each
page reads Lumen through `api-edge` with the person's own session when it
loads; forms post to `/lumen/*` on the CMS, which calls `api-edge` and comes
back to the page with *Saved.* or what went wrong.

| Page | Path | Shows | Changes |
|---|---|---|---|
| Profile | `/admin/account` (Payload's account page, replaced) | email, CMS role, Lumen user id | display name (copied onto the `users` row) |
| Security activity | `/admin/account/security` | sign-ins, codes and sessions, newest first, 50 a page | — |
| Organization | `/admin/organization` | the Lumen organization (Solo: the personal one) | — (renaming is not in the API) |
| Notifications | `/admin/organization/notifications` | email categories for that organization | which categories Lumen emails |
| Billing & plan | `/admin/organization/billing` | the plan, its status and renewal, what it includes, invoices | upgrade (the provider's checkout), switch or cancel a paid plan, the provider's portal |

Paying never happens in the CMS: *Upgrade* sends the browser to the payment
provider's checkout, which returns to Billing & plan (`?checkout=complete`);
the page then posts one reconcile, so it does not wait for the provider's
webhook. *Manage payment and invoices* opens the provider's customer portal;
it appears only for a paid subscription the provider manages. These are the
staff member's own Lumen account and organization, not an academy's.

A page that cannot reach Lumen says so (for example *The CMS could not reach
Lumen*) instead of failing: check `api-edge` and the `LUMEN_API` binding.

## Open the admin (first admin)

Nobody becomes an admin by signing in, except through setup, which the owner
opens. Once per environment:

1. Choose a token of at least 16 characters, and keep it to yourself.
2. Give it to the Worker, either way:
   - in the workspace's secrets as `CMS_SETUP_TOKEN`, for that environment or
     on the workspace-shared rung (both environments read it). The CMS's next
     deploy pushes it to the Worker: run the on-demand deploy (Actions → CI →
     Run workflow, component `cms`, environment `stage` or `prod`), or merge any
     change under `apps/cms`. Re-running an earlier run does not deploy: the
     lane's recorded result is reused; or
   - directly: `pnpm exec wrangler secret put CMS_SETUP_TOKEN --name multi-tenant-saas-2-cms-<env>`
     (it prompts for the value).
3. Visit `https://multi-tenant-saas-2-cms-<env>.nexo-7be.workers.dev/setup?token=<token>`.
   It sets a 15-minute cookie and sends you to the sign-in page.
4. Sign in with your Lumen account. While no admin exists, the account that
   signs in with that cookie becomes the admin (a pending account is promoted).
   From then on, admins give everyone else their role in *Users*, and setup
   changes nothing.

You can delete `CMS_SETUP_TOKEN` afterwards; nothing needs it.

## Run the academy

After the first admin exists (above), everything is in `/admin`:

1. **Add an academy.** *Learning → Academies → Create*: a name (the slug is
   derived) and whether enrolment is open. *Demo Academy* ships as a sample;
   edit or delete it.
2. **Add an instructor.** *Users → Create*: their email, role *Instructor*,
   and the academies they teach. That is an invitation: when they sign in with
   the Lumen account of that email, they land on this row. (Or let them sign in
   first and give their pending account the role.) Instructors see and change only their academies'
   courses, lessons and quizzes, and read their learners' records there.
3. **Write a course.** *Learning → Courses → Create* in the academy, then save
   it as a draft. Add *Lessons* (order, title, minutes, text, an optional
   YouTube, Vimeo or https video URL) and a *Quiz* (questions, options, the
   correct option, the passing score). Learners see none of it until the
   course is **published**.
4. **Publish.** On the course, *Publish changes*. It appears in the catalogue
   at `/`, and learners can enrol.
5. **Check it as a learner.** In a second browser profile, register at
   `/register`, enrol, and walk it. (Staff and learners have separate sessions,
   but where a browser holds both, the staff one wins and the academy sees no
   learner.)

A course is complete when every lesson is marked complete and every quiz is
passed; the certificate is issued at that moment, and its page,
`/certificates/<serial>`, is public.

### Learner support

- **Locked out after failed sign-ins**: they can retry after 10 minutes, or an
  admin opens the learner in *Learning → Learners* and unlocks the account.
- **Forgotten password**: there is no email yet, so an admin sets a new
  password on the learner in *Learning → Learners*.
- **A record is wrong** (say, a lesson marked complete by mistake): admins can
  edit or delete enrolments, progress, attempts and certificates in
  *Learning*. Learners cannot write them at all.
- **Closing an academy** (*enrolment: closed*) stops new enrolments; enrolled
  learners keep their place and can finish.

## Verify

```bash
B=https://multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev
curl -fsS $B/health                                   # {"status":"ok","db":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' $B/admin      # 200, the Lumen staff sign-in
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/users/login \
  -H content-type:application/json -d '{"email":"x@example.com","password":"x"}'   # 403: no staff passwords
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/users/first-register \
  -H content-type:application/json -d '{"email":"x@example.com","password":"x"}'   # 403
curl -fsS "$B/api/pages?limit=5"                      # published pages only
curl -fsS "$B/" | grep -c 'data-page="catalogue"'     # 1: the learner catalogue renders
curl -fsS "$B/api/courses?where[slug][equals]=getting-started" -g   # the sample course
curl -fsS "$B/api/lms/certificates/<serial>"          # a certificate, by serial
```

## Change a collection

1. Edit the collection in `src/collections/` and run the app locally (below).
2. `PAYLOAD_SECRET=local-only DATABASE_URL=<local db with every migration applied> pnpm payload migrate:create <name>`
   writes a migration and snapshot to `payload-migrations/` (Payload will not
   start without a secret; any value does locally).
3. Convert it: `node scripts/payload-migration-to-sql.mjs payload-migrations/<file>.ts > ../../packages/db/src/migrations/<id>/up.sql`.
   Exit code 2 means a statement could not be made idempotent (a drop, rename
   or type change): rewrite it by hand into a safe, re-runnable form and say so
   in the pull request.
4. Add `<id>` to `packages/db/src/manifest.ts` with `context: "cms"` and the
   file's sha256, and to `CONVERTED` in `tests/cms/src/migration-sync.test.ts`.
5. `pnpm generate:types` and `pnpm generate:importmap` if fields or admin
   components changed.
6. Prove the SQL is exactly Payload's schema: apply every migration to one
   empty database, let Payload push its schema into another
   (`PAYLOAD_SECRET=x PAYLOAD_PUSH=true DATABASE_URL=<empty db> pnpm payload run scripts/init-payload.ts`),
   and compare `pg_dump -s -n cms` of the two (ignore the `\restrict` lines).
   They must be identical; re-applying the new migration must succeed too.

## Run it locally

```bash
# Postgres 16 on 127.0.0.1:54329 with a database `cms`, then:
export DATABASE_URL=postgres://postgres:<pw>@127.0.0.1:54329/cms
for m in 200_cms_payload_core 300_lms_course_model 301_lms_sample_academy 310_lms_learner_records 320_cms_lumen_identity; do
  psql "$DATABASE_URL" -f ../../packages/db/src/migrations/$m/up.sql
done
pnpm dev                                        # Node, http://localhost:3002

# The real runtime (workerd), after `pnpm build`:
node ../../tooling/wire/render.mjs --template wrangler.template.jsonc --out wrangler.jsonc --map wiring.fixture.json
# no api-edge runs locally: drop env.stage.services from wrangler.jsonc, and
# point the CMS at stage's api-edge instead
printf 'PAYLOAD_SECRET=%s\nCMS_SETUP_TOKEN=%s\nLUMEN_API_URL=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 16)" \
  https://multi-tenant-saas-2-api-edge-stage.nexo-7be.workers.dev > .dev.vars
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_CMS="$DATABASE_URL" \
  pnpm exec wrangler dev --config wrangler.jsonc --env stage --port 8799 --ip 127.0.0.1
```

`wrangler dev` needs a password in the local connection string. Without the
`LUMEN_API` service binding the CMS reaches `api-edge` over `LUMEN_API_URL`.
Stage's `api-edge` accepts `http://127.0.0.1:<port>` and shows the emailed
code on the sign-in page, so a local staff sign-in needs no inbox.

## Common failures

- **Billing & plan says "no payment provider is configured".** The billing
  worker of that environment has no provider credentials (stage, today), so
  checkout and the portal cannot start; plans, entitlements and invoices
  still show.
- **An account page says "Lumen answered with an error (internal_error)".**
  api-edge or the worker behind it failed; its logs carry the request id.
  Security activity answered 503 for everyone until identity-worker queried
  events by the user's UUID rather than its public `usr_` id (LX2).

- **Smoke: `/health` answers 503.** The body names the part that failed, and
  the Worker's logs (observability is on) carry the error:
  - `{"secret":"missing"}`: `PAYLOAD_SECRET` is not on the Worker. `secrets-live`
    pushes it right after `wrangler deploy`; if it reported the secret as "not
    seeded", `cloudflare-hyperdrive-cms` has not published `CMS_PAYLOAD_SECRET`
    for that environment yet.
  - `{"payload":"error"}`: Payload could not start, which on a deployed Worker
    is almost always the database being unreachable at startup.
  - `{"db":"error"}`: Payload started but the query failed: check that
    `cloudflare-hyperdrive-cms` applied, that the deploy rendered the right
    `HYPERDRIVE_CMS` id, and that db-migrate applied migration 200.
- **Deploy: "exceeds the size limit" or CPU errors (1102).** The account is on
  Workers Free. The CMS needs Workers Paid.
- **Requests hang for 10 s, then 500.** A regression to a shared pool: the
  adapter must get `requestScopedPg` on Workers (`src/payload.config.ts`), and
  `cms-tests`' `request-scoped-pool` suite should have caught it.
- **Build: "Failed to collect configuration … connectionString".** Something at
  build time reached for the binding: `src/lib/runtime.ts` must keep
  `NEXT_PHASE=phase-production-build` out of the Workers branch.

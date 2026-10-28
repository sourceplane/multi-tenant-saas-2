# cms — runbook

## How it deploys

A merge to `main` that changes `apps/cms` deploys stage, then prod, in the
CMS's own lane, after `cloudflare-hyperdrive-cms` and `db-migrate` for that
environment. The lane builds, renders the wrangler config from the published
wiring, runs `wrangler deploy`, pushes the runtime secrets, and smoke-checks
`/health` and `/admin` (retried for about 4.5 minutes). Pull requests build,
typecheck and dry-run the deploy; nothing deploys from a pull request.

## Open the admin (first account)

The CMS ships closed: nobody can create the first account until the owner opens
setup. Once per environment:

1. Choose a token of at least 16 characters, and keep it to yourself.
2. Give it to the Worker, either way:
   - in the workspace's secrets for that environment, as `CMS_SETUP_TOKEN`; the
     next CMS deploy pushes it; or
   - directly: `pnpm exec wrangler secret put CMS_SETUP_TOKEN --name multi-tenant-saas-2-cms-<env>`
     (it prompts for the value).
3. Visit `https://multi-tenant-saas-2-cms-<env>.nexo-7be.workers.dev/setup?token=<token>`.
   It sets a 15-minute cookie and sends you to `/admin/create-first-user`.
4. Create the account. It becomes an admin. From then on, admins create every
   other account in `/admin`, and setup is irrelevant.

You can delete `CMS_SETUP_TOKEN` afterwards; nothing needs it.

## Run the academy

After the first admin exists (above), everything is in `/admin`:

1. **Add an academy.** *Learning → Academies → Create*: a name (the slug is
   derived) and whether enrolment is open. *Demo Academy* ships as a sample;
   edit or delete it.
2. **Add an instructor.** *Users → Create*: email, a temporary password, role
   *Instructor*, and the academies they teach. Tell them to change the
   password after signing in. Instructors see and change only their academies'
   courses, lessons and quizzes, and read their learners' records there.
3. **Write a course.** *Learning → Courses → Create* in the academy, then save
   it as a draft. Add *Lessons* (order, title, minutes, text, an optional
   YouTube, Vimeo or https video URL) and a *Quiz* (questions, options, the
   correct option, the passing score). Learners see none of it until the
   course is **published**.
4. **Publish.** On the course, *Publish changes*. It appears in the catalogue
   at `/`, and learners can enrol.
5. **Check it as a learner.** In a second browser profile (staff and learners
   share one session cookie), register at `/register`, enrol, and walk it.

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
curl -s -o /dev/null -w '%{http_code}\n' $B/admin      # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/users/first-register \
  -H content-type:application/json -d '{"email":"x@example.com","password":"x"}'   # 403
curl -fsS "$B/api/pages?limit=5"                      # published pages only
curl -fsS "$B/" | grep -c 'data-page="catalogue"'     # 1: the learner catalogue renders
curl -fsS "$B/api/courses?where[slug][equals]=getting-started" -g   # the sample course
curl -fsS "$B/api/lms/certificates/<serial>"          # a certificate, by serial
curl -fsS "$B/api/media?limit=5"                      # media, anonymously readable
```

## Media

Staff upload images (JPEG, PNG, GIF, WebP, AVIF) and PDFs in *Media* in
`/admin`, or embed them from rich text. Each upload needs alt text and is at
most 10 MiB; SVG is refused. Files are stored in the environment's R2 bucket
(`stg-multi-tenant-saas-2-cms-media-stage`, `prod-multi-tenant-saas-2-cms-media-prod`;
`infra/terraform/cloudflare-r2-cms`) and served at `/api/media/file/<filename>`
to anyone, so put nothing there that only enrolled learners may see. A second
file with the same name gets a suffix (`photo-1.jpg`).

Every file belongs to the site or to one academy (*Academy* in the sidebar):

| who | uploads | edits or replaces | deletes |
|---|---|---|---|
| admin | anywhere | everything | yes |
| editor | the site's media (no academy) | the site's media | no |
| instructor | their academies' media (academy required) | their academies' media | no |

Deleting removes the object from the bucket too.

```bash
# as an instructor (a session token from /api/users/login), into their academy:
curl -H "Authorization: JWT <token>" -F "file=@photo.jpg;type=image/jpeg" \
  -F '_payload={"alt":"What the photo shows","tenant":"<academy id>"}' "$B/api/media"
curl -fsS -o /dev/null -w '%{http_code}\n' "$B/api/media/file/photo.jpg"   # 200
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
for m in 200_cms_payload_core 300_lms_course_model 301_lms_sample_academy 310_lms_learner_records 320_cms_media; do
  psql "$DATABASE_URL" -f ../../packages/db/src/migrations/$m/up.sql
done
pnpm dev                                        # Node, http://localhost:3002; uploads go to a local folder

# The real runtime (workerd), after `pnpm build`:
node ../../tooling/wire/render.mjs --template wrangler.template.jsonc --out wrangler.jsonc --map wiring.fixture.json
printf 'PAYLOAD_SECRET=%s\nCMS_SETUP_TOKEN=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 16)" > .dev.vars
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_CMS="$DATABASE_URL" \
  pnpm exec wrangler dev --config wrangler.jsonc --env stage --port 8799
```

`wrangler dev` needs a password in the local connection string. It serves
`R2_MEDIA` from a local bucket under `.wrangler/state`, so uploads exercise the
real R2 adapter.

## Common failures

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
- **Deploy: "Authentication error [code: 10000]" on `/r2/buckets/<name>`.**
  Wrangler's resource provisioning checked the bucket with the brokered
  `workers-deploy` token, which has no R2 permission. `skipResourceProvisioning:
  true` in `component.yaml` turns that check off (stack-tectonic 0.21.0 and
  later); check it is still set and the stack pin in `intent.yaml` has not
  gone back below 0.21.0. The bucket itself comes from `cloudflare-r2-cms`.
- **Uploads fail with "R2_MEDIA binding is missing".** The deploy rendered no
  `R2_MEDIA` binding: check that `cloudflare-r2-cms` applied for that
  environment and published `WIRING_CLOUDFLARE_R2_CMS`, then redeploy the CMS.
- **An upload answers 413.** It is over 10 MiB (`MEDIA_MAX_BYTES` in
  `src/collections/Media.ts`).
- **An upload or edit answers 403 "You can only add media to your own
  academies."** An instructor's file needs one of their academies in
  *Academy*; editors' files need it empty. Admins assign academies to
  instructors in *Users*.
- **Deploy: "exceeds the size limit" or CPU errors (1102).** The account is on
  Workers Free. The CMS needs Workers Paid.
- **Requests hang for 10 s, then 500.** A regression to a shared pool: the
  adapter must get `requestScopedPg` on Workers (`src/payload.config.ts`), and
  `cms-tests`' `request-scoped-pool` suite should have caught it.
- **Build: "Failed to collect configuration … connectionString".** Something at
  build time reached for the binding: `src/lib/runtime.ts` must keep
  `NEXT_PHASE=phase-production-build` out of the Workers branch.

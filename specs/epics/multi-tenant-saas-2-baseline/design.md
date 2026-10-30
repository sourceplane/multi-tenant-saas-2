# Design — multi-tenant-saas-2-baseline

## 1. What a product gets

Everything multi-tenant-saas-2 runs, under the product's own name: the twelve
bounded-context Workers behind `api-edge`, Supabase Postgres through
Hyperdrive, the edge's idempotency KV, `db-migrate` — and the CMS:

- `apps/cms` — the learning platform: Payload 3 on Next.js (OpenNext) on
  Workers over schema `cms`, through its own cache-disabled Hyperdrive config,
  with media in R2. At its root, the academies' catalogue, courses, lessons
  with video, quizzes and the learner app (learners are their own auth
  collection; enrolments, progress, attempts and certificates are written only
  by its transactional `/api/lms` services). At `/admin`, the staff console:
  staff sign in with the product's own accounts over a service binding to
  `api-edge`, and it holds the account, organization, notifications,
  security-activity and billing pages. A sample academy is seeded by
  migration 301.
- `apps/web-console-next` — the console URL, a 308 into the CMS admin.
- `infra/terraform/cloudflare-hyperdrive-cms`, `infra/terraform/cloudflare-r2-cms`
  — the CMS's database path (and its generated `PAYLOAD_SECRET`) and bucket.

And none of the factory (`testing/leak.test.sh`, `placement.test.sh`), none of
this repository's planning state, and none of its live record: a product's
`ai/context/deployment.md` starts as the "not rendered yet" stub, because this
repository's own would claim the product's URLs answer before they exist.

## 2. Where the CMS lands — Lumen's phases, not new ones

The barrier law decides it: a module may not depend on one in a later phase,
and a phase's PR lanes may not read what only a later apply publishes.

| module | phase | why there |
|---|---|---|
| `cloudflare-r2-cms` | `03-infrastructure` | reads nothing anyone publishes |
| `cloudflare-hyperdrive-cms` | `03-infrastructure-database` | plans against supabase's outputs, exactly as `cloudflare-hyperdrive` does |
| `cms`, `cms-tests` | `06-console` | binds what 03/03-db publish and `api-edge` (05); it is the console |
| `web-console-next` (redirect) | `06-console` | `dependsOn` the CMS, so one convergence deploys the CMS first |

`CLOUDFLARE_R2_TOKEN` (`r2-data`) is minted with its siblings in 03's one
Cloudflare reconcile. 06's verify probes the edge's and the CMS's `/health`
(200 — the CMS's is a round trip to schema `cms`) and the console URL (308,
not followed). The first CMS admin is the owner's step, documented, not the
build's: it would mean a build holding an admin's credential.

Lumen's prebuilt-console machinery (`console-artifact.mjs`, its pin, its
publish job in `tag.yml`, its test) is not carried: this baseline's console is
the CMS, which every product builds.

## 3. The rebrand

`tooling/rebrand/rebrand.mjs` keeps Lumen's engine — the protected org-owned
literals, the held (opaque) substituted values, the guard that keeps a later
phase's pass from re-rewriting what an earlier one wrote, the leftover sweep —
and changes two things.

**The left-hand side is this repository's own identity**, read from its
committed `.rebrand/values.json` (reponame, productname, subdomain,
workspace) and derived into every case-form, so the same file serves every
baseline built this way.

**The platform word**, `lumen`, in every case-form, is renamed into the
product's:

| form | example | becomes |
|---|---|---|
| env / binding | `LUMEN_API` | `<ENV>_API` (from cliBin) |
| PascalCase, glued | `LumenLogin` | `<Pascal>Login` |
| camelCase | `lumenUserId` | `<camel>UserId` |
| snake_case | `lumen_user_id`, `320_cms_lumen_identity` | `<snake>_user_id` — snake derived from the camel form **as Payload's adapter derives a column from a field** (to-snake-case: every capital starts a word), so the field and its column stay one name |
| slug | `lib/lumen/`, `/auth/lumen/`, `'lumen'` | `<brandSlug>` |
| display | "your Lumen account" | the product name |

Paths are renamed by the same rules (`git mv`), so a directory and the imports,
routes and migration names pointing into it stay one string. A migration the
rebrand rewrote is re-sealed in `packages/db/src/manifest.ts` — the runner
refuses a file that does not hash to its checksum, on plan and on apply — and
only those: a stale checksum on an untouched migration is a hand edit the
runner should keep refusing.

The sweep counts as residue `lumen` in any case and position, the baseline's
own name in every form, and its subdomain and workspace when the product's
differ — over contents and paths.

## 4. The gates

Lumen's Tier 0 and 1, adapted, plus a Tier 2 Lumen does not have:

- Tier 0 (`baseline-contract`): manifest, phases, coverage, rebrand, retouch,
  bootstrap-defer, fleet-stubs, pen-reset. fleet-stubs learns a second way a
  binding holder's targets exist first — every Worker it binds is an enforced
  dependency (the CMS binds only api-edge, two phases earlier).
- Tier 1 (`blueprint-parses`): the document read by the pinned CLI, the leak
  gate, the placement through a rebrand.
- Tier 2 (`branded-fork`): the product placed and branded, then asked about
  itself — the lockfile refreshed, a frozen install, every package
  typechecked, every Worker config rendered from its fixture, every suite.

Tier 2 found four things before any product did: a test's `const lumen`
(becoming `const acme-cloud`), the migration checksum, and two failures this
repository already had and its own CI never ran — `platform-limits`' chain
depth after the CMS's binding, and the CMS's undeclared `contracts` edge —
both on `quick-check` lanes that run no tests (docs/components/REVIEW.md).

## 5. The card and the registry

`blueprint.yaml`: "Multi-tenant LMS", tags saas/lms/cms/cloudflare/
supabase/payload/nextjs, six secrets, seven milestones, 23 minutes. The
registry row (orun-cloud) is `multi-tenant-saas-2`, public, free, kind platform on
Orunbase, at `baseline-v1`.

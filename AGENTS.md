# AGENTS.md — Payload LMS

You are working in `sourceplane/payload-lms`, a multi-tenant SaaS on
Cloudflare Workers and Supabase Postgres. It is an Orun desired-state repo:
every directory with a `component.yaml` is a component, and merging to `main`
is what deploys it.

## Read first, in this order

1. [`ai/context/operations.md`](ai/context/operations.md) — the operating
   contract: how a merge deploys, the secrets model, how to verify, common
   operations.
2. [`ai/context/deployment.md`](ai/context/deployment.md) — this product's
   live facts: URLs, workspace, secrets by name. Generated, so it is only as
   current as its last refresh.
3. [`intent.yaml`](intent.yaml) — the environments (`dev` verify-only,
   `stage`, then `prod`), the pinned composition catalog, the workspace.
4. `apps/api-edge/docs/` — the one public entry point and how it routes to
   the workers. Every app has the same three pages: overview, architecture,
   runbook.
5. `apps/cms/docs/` — the learning platform, which is also the staff
   console: the academy at `/`, the Payload admin at `/admin` with Lumen
   sign-in and the account and billing pages, how it deploys, how the owner
   opens its admin and runs an academy, and how to change a collection (a
   migration, never a push).
6. `apps/web-console-next/docs/` — the old console URL, now a redirect
   Worker into the CMS.

## This repository is also a baseline

Products are built from it by `repo-blueprint.yaml` ([BOOTSTRAP.md](BOOTSTRAP.md)).
The factory — `blueprint.yaml`, `repo-blueprint.yaml`, `.baseline/product/`,
`tooling/rebrand/`, `tooling/bootstrap/`, `hooks/`, `testing/`,
`docs/phases/`, `tasks/0*.TaskContract.yaml`, `.github/workflows/baseline.yml`
and `tag.yml` — never ships to a product. Two consequences for any change:

- **A new component needs a module and a phase** in `repo-blueprint.yaml`,
  or no product gets it: `testing/coverage.test.sh` fails until it has one.
- **Code that names the platform is renamed in every product.** The rebrand
  turns `lumen` in any case-form — `lumenUserId`, `lumen_user_id`, `LUMEN_API`,
  `LumenLogin`, `lib/lumen/`, "Lumen account" — into the product's name, paths
  included. Keep a bare `lumen` out of identifier positions (a variable named
  `lumen` becomes a slug, which is not an identifier); `testing/branded-fork.test.sh`
  places a product and runs its typecheck and suites, and catches it.

Run the gates with `bash testing/<name>.test.sh` (leak, placement and
branded-fork need `orun` ≥ v2.88.0 on `PATH`; branded-fork needs `pnpm`).

## Layout

- `apps/api-edge` is public; the twelve `apps/*-worker` are reached only
  through it, over service bindings.
- `apps/cms` — the product: Payload CMS on Workers (OpenNext), public on
  its own hostname. The academy is its root, where learners sign in with
  their own accounts. Its admin is the staff console: a Lumen account signs
  in (no Payload passwords), and the account, organization, notifications,
  security activity and billing pages call `api-edge` server to server over
  the `LUMEN_API` service binding. No worker calls the CMS. Academies,
  courses, learners and their records live in schema `cms`, changed only by
  migrations in `packages/db`.
- `apps/web-console-next` — a small redirect Worker: every old console
  path answers 308 to its place in the same environment's CMS.
- `packages/*` — contracts, SDK, CLI, database harness, policy engine.
- `infra/terraform/*` — Supabase, Hyperdrive, KV, the CMS's own Hyperdrive
  (`cloudflare-hyperdrive-cms`) and media bucket on R2 (`cloudflare-r2-cms`);
  `infra/db-migrate` — the schema
  migrations.
- `tests/*` — one suite per component.

## How a change lands

- One task, one branch, one pull request into `main`.
- Locally: `pnpm install`, then `pnpm typecheck`, `pnpm lint`, `pnpm test`
  and `pnpm build`.
- `orun plan --changed --intent intent.yaml` lists the component lanes your
  change plans — what CI will run. A change that touches no component plans
  nothing and deploys nothing.
- The pull request's CI plans and verifies. Merging deploys `stage`, then
  `prod`. A green run is not proof: check the URLs and the published wiring
  the way `operations.md` shows.
- A new component is a directory under `apps/`, `packages/`, `infra/` or
  `tests/` with a `component.yaml`; Orun discovers it on the next plan.
- Secrets are never committed. Provider credentials are brokered per run;
  runtime secrets are set with `orun secrets set`.

## Do not touch

- `execution.state` in `intent.yaml` (`workspace`, `backendUrl`,
  `requireOrg`): CI's credential-free sign-in depends on it.
- `.rebrand/values.json` — this product's identity record; the docs refresh
  reads it, and the rebrand reads it as the baseline's own names. It still
  says `multi-tenant-saas-2`, the repository's name until 2026-10-30, and so
  does everything deployed (README → Names): leave both.
- `ai/context/deployment.md`, and the README between the `08-docs` markers:
  both are regenerated, and hand edits are overwritten.
- `.github/workflows/ci.yml` beyond its version pins. CI runs `orun plan` and
  `orun run`, never pnpm, Wrangler or Terraform directly.
- `pnpm-lock.yaml` by hand — run `pnpm install`.
- A worker's `wrangler.jsonc` where a `wrangler.template.jsonc` sits beside
  it: edit the template; the render is gitignored.
- The service bindings between billing, membership, notifications and events
  form a loop that deploys in two passes on a fresh account. The loop is
  pinned in `tests/config-worker/src/deployment-config.test.ts`; do not grow
  it.

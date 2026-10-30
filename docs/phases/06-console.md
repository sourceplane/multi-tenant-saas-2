# Phase 06 — console

Lands the **learning platform** (`repo-blueprint.yaml`, phase `06-console`),
which in this baseline is the product and its console at once: **Payload CMS**
on Workers, serving the academies' catalogue, courses, lessons, quizzes, the
learner app (learners with their own accounts, progress and certificates) at
its root, and at `/admin` the staff console — signed in with the product's own
accounts and holding the account, organization, notifications,
security-activity and billing pages. The
console's URL lands with it as a small redirect Worker into the CMS, and the
custom-domain component lands parked
([below](#the-custom-domain--parked)). It proves the edge, the CMS and the
redirect live on stage and prod.

## What it lands

- `apps/cms` (+ `tests/cms`, whose suite runs inside the CMS lane's build):
  the learning platform — academies (the tenants), courses, lessons and
  quizzes, learner records written only by its transactional `/api/lms`
  services, and the staff admin — Payload 3 on Next.js, built with OpenNext
  and deployed as
  `<reponame>-cms-<env>` in its own lane per environment. It binds what the
  data plane published — its cache-disabled Hyperdrive config
  (`cloudflare-hyperdrive-cms`, 03-db), its media bucket
  (`cloudflare-r2-cms`, 03), its generated `PAYLOAD_SECRET` — and reaches
  `api-edge` (05) over a service binding to check sessions. Its schema,
  `cms`, was applied by `db-migrate` in 03-db; the CMS never migrates
  itself. The CMS build is the heaviest lane in the product: measured at
  6–7 minutes from merge to both environments deployed
  ([TIMINGS](TIMINGS.md)), which is why this phase's convergence watch waits
  up to 45 minutes.
- `apps/web-console-next` (+ its suite): the console's URL, kept so links
  and bookmarks work. Every path answers **308** with its place in the same
  environment's CMS (`/login` → `/admin/login`, `/auth/callback` → the CMS's
  sign-in callback, …), and nothing else runs there. It `dependsOn` the CMS,
  so one convergence deploys the CMS first.
- `infra/terraform/cloudflare-domain`, parked.

`testing/phases.test.sh` holds the set.

## The first admin is the owner's

Learners register themselves from the academy's `/register`. The staff admin
opens to **nobody** until the owner says so. Signing in with an
account works from the first deploy, but a person with no role is
*pending*; the first admin is made with a setup token the owner chooses
and gives the CMS as the workspace secret `CMS_SETUP_TOKEN` (per environment
or on the shared rung), deploys the CMS once so the Worker has it, visits
`/setup?token=…` and signs in — the account that signs in with that cookie
while no admin exists becomes the admin. The secret can be deleted after.
Every later person is given a role from inside the admin. The
product's `apps/cms/docs/runbook.md` ("Open the admin (first admin)") is the
step. A bootstrap does not do it — it would mean a build holding an admin's
credential — so this phase's probes check `/health`, not a signed-in page.

## The custom domain — parked

`infra/terraform/cloudflare-domain` — the zone lookup and, once wired, a
custom domain per environment for the CMS
(`CONSOLE_CUSTOM_DOMAIN` in the product's `intent.yaml`:
`stage.<productdomain>` and `prod.<productdomain>` after rebrand, empty for
`dev` — and, since the console asks for no domain, `<productdomain>` is the
placeholder `<reponame>.example.com` until an owner sets one) — lands with
the console and **deploys nothing**, for two reasons that live in the
component rather than in the phase:

1. **It ships parked.** Its `component.yaml` declares
   `subscribe.environments: []`, so CI plans no lanes for it. The product
   runs on workers.dev URLs until an owner wires it.
2. **The attachment is fenced off.** The component is midway through a
   two-step migration to Cloudflare provider v5: the v4
   `cloudflare_workers_domain` resource was dropped from state and its block
   is commented out until the v5 `cloudflare_workers_custom_domain` replaces
   it. Un-parked as it stands, the root would look up the zone and attach
   nothing.

It used to land on its own as the optional `07-domain` phase, behind a
`domain` input. That landing deployed nothing either — its convergence was a
green run with nothing in it — so the phase and the switch are gone, and
this phase's task contract leaves the component out of `affects`: there is
nothing in it to re-plan.

Wiring it is a normal pull request in the product, once the zone exists.
The product's `ai/context/operations.md` ("Setting the domain later") carries
the whole list for its owner: replace the placeholder everywhere it stands
(`git grep -l <reponame>.example.com` — intent, the edge and identity console
origins, the mail sender, the billing return URLs), then:

1. **The zone first.** The product zone (e.g. `acme.dev`) must already exist
   in the Cloudflare account the product deploys into, created in the
   dashboard; zone creation is an account-plan operation the platform does
   not broker. The component runs with `zoneMode: existing`: it looks the
   zone up by `baseDomain` and manages records and custom domains IN it, not
   the zone itself. Without the zone a plan fails with `no zone found` (or
   the brokered token's account is not the zone's).
2. **Finish the v5 resource and restore the `subscribe` block** the
   component carries commented out — both are described in its own comments,
   and its `README.md` says where the migration stands.
3. **Land it.** The convergence on `main` applies it; check the product
   resolves on its own domain (DNS propagation applies), then re-run
   [`08-docs`](08-docs.md) so the deployment manifest records the
   custom-domain URLs.

## Inputs

`--out` is the product repo. The blueprint's required inputs — `reponame`,
`productname`, `githuborg` — are validated before any phase
runs, so pass them on every invocation; the product's own
`.rebrand/values.json` is a complete values file. See
[the phases README](README.md#inputs).

## Steps

1. **requires** — `05-edge` placed.
2. **pre** — the phase's task.
3. **place** → **brand** → **lockfile** → **land** — the standard contract
   (PR `phase(06-console): the CMS console`).
4. **converge** — `orun.run/watch@v1` on the merged commit.
5. **verify** — two `orun.http/probe@v1` `await` hooks: the edge's and the
   CMS's `/health` on stage and prod (200), then the console URL on stage and
   prod (**308** — the probe does not follow redirects, so a 200 there would
   mean the old console came back).

## Verify / done means

Six URLs answer as designed:
`https://<reponame>-api-edge-{stage,prod}.<subdomain>.workers.dev/health` and
`https://<reponame>-cms-{stage,prod}.<subdomain>.workers.dev/health` with 200,
and `https://<reponame>-web-console-next-{stage,prod}.<subdomain>.workers.dev`
with 308. The CMS's `/health` is a real round trip — Payload starts with its
secret and counts `users` through its Hyperdrive config in schema `cms` — so
a 200 means it can serve, not merely that a Worker answered. **This is the
"working baseline" moment**: after this phase the product is live end to
end — the sample academy's catalogue at the CMS root — waiting only for its
owner to open the staff admin.

## Troubleshooting

- **`/health` answers 503 `{"secret":"missing"}`** — the CMS deployed before
  its `PAYLOAD_SECRET` was pushed. The deploy lane's `secrets-live` step
  pushes it right after the first deploy; a 503 that persists means
  `CMS_PAYLOAD_SECRET` is not published for that environment — re-run
  `03-infrastructure-database`, whose verify names it.
- **`/health` answers 503 `{"db":…}`** — Payload started and could not reach
  schema `cms`: either `db-migrate` has not applied 200 and the CMS's later
  migrations, or the Hyperdrive config is wrong. The CMS runbook's "Common
  failures" has the checks.
- **The deploy fails with `Authentication error [code: 10000]` on
  `/r2/buckets/…`** — wrangler tried to provision the R2 bucket with the
  deploy token, which has no R2 permission. The component sets
  `skipResourceProvisioning: true` (stack-tectonic 0.21.0 or later); a pinned
  catalog older than that does not know the setting.
- **The console URL answers 200 or 404 instead of 308** — the redirect only
  serves its own `<reponame>-web-console-next-<env>` hosts. A 404 on that
  host means the Worker deployed under another name; check the rebrand
  renamed `CMS_WORKER_PREFIX` and the host pattern in its `src/worker.ts`.
- **The convergence needs its resumes** — the CMS lane is long, and a lane
  that dies before its build is resumed by the watch. Resumes spent here are
  not a regression by themselves.

## Example commands

From the baseline checkout:

```bash
orun new --blueprint repo-blueprint.yaml --out $HOME/sourceplane/acme \
  --run-hooks --phase 06-console \
  --values $HOME/sourceplane/acme/.rebrand/values.json
```

Headless (fresh container / no checkout — see BOOTSTRAP.md §2): clone the
baseline at a tag and run the same command, with `ORUN_TOKEN` +
`GITHUB_TOKEN` exported:

```bash
export ORUN_TOKEN="$(orun auth token | tail -1)" GITHUB_TOKEN=…
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/multi-tenant-saas-2
cd multi-tenant-saas-2
orun new --blueprint repo-blueprint.yaml --out /work/acme \
  --run-hooks --phase 06-console --values /work/acme.values.yaml
```

Preview with zero side effects: drop `--run-hooks` — the phase places files
and stops, with no landing, no convergence watch and no probe. `--status`
derives every phase's state and writes nothing at all. Re-running a
completed phase is safe: the placement is a no-op, the landing finds
nothing new, and the `await` hooks re-probe.

## Next

[Phase 08 — docs](08-docs.md) records what was built. The owner opens the
admin ([above](#the-first-admin-is-the-owners)); the custom domain is wired
later, in an ordinary PR ([above](#the-custom-domain--parked)).

Post-baseline: seed runtime worker secrets (`orun secrets set <KEY> --org
<ws> --env <env>`; wire-now-seed-later, nothing blocks on them) and ship
normal PRs.

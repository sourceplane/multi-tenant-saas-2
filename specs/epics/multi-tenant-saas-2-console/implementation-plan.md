# multi-tenant-saas-2-console — implementation plan

Milestones land in order, one task per pull request, on `orun/LX-<n>-<slug>`
branches with an `Orun-Task: LX-<n>` trailer on every commit. A pull request
merges only on green, and a milestone is done only when its "done when" list
is true on the live system. Each milestone ports the matching
`sourceplane/lumen-payload` change as it shipped, renamed to this
repository, with the differences in `design.md` applied.

| Milestone | Task | Ports |
|---|---|---|
| LX0 — the spec | LX-1 | — |
| LX1 — staff sign-in | LX-2 | lumen-payload#22 (PX1) |
| LX2 — account and billing | LX-3 | lumen-payload#23 and #24 (PX2, PX3) |
| LX3 — the front door | LX-4 | lumen-payload#25 (PX4), without the root redirect |
| LX4 — the record | LX-5 | lumen-payload#26 (PX5) |

PX2 and PX3 land together here: both are admin views over the same client,
already reviewed and verified as a pair upstream.

## LX0 — the spec

This doc set and `tasks/LX-1.TaskContract.yaml`.

**Done when**
- the five documents are on `main`

## LX1 — staff sign-in

`users` off the local strategy and onto `lumen`; `lumenUserId`; `role`
optional (pending); the pending page; the setup-token first admin; sign-out
that revokes; the `isForeignOrigin` guard; migration `320_cms_lumen_identity`
and the converter change; `LUMEN_API` service binding; api-edge CORS and
identity-worker's OAuth return allowlist gain the CMS origins; tests and docs.

**Done when**
- every lane of the PR is green
- after the merge, on stage and prod: `/admin` shows the Lumen sign-in,
  password login and `first-register` answer 403, and `/health` is ok
- on stage: a newcomer is pending; with setup open, the first sign-in is
  admin; an admin makes another account an instructor of the sample academy,
  who sees only its courses; a learner registers and signs in at `/login`

## LX2 — account and billing

The five pages and their `/lumen/…` handlers; the shared session lookup and
stale-if-error; `frame-ancestors 'self'`; identity-worker's security-events
UUID fix; api-edge's `account` rate family.

**Done when**
- on stage, the display name and a notification category change from the
  admin and read back through `api-edge`
- on stage, Security activity lists the sign-in, and Billing & plan shows
  the plan or explains that no provider is configured
- a pending or signed-out visitor cannot open the pages or post their forms

## LX3 — the front door

The console Worker becomes the redirect Worker; `intent.yaml`'s product URLs
become the CMS root; `POLAR_SUCCESS_URL` the CMS billing page; the parked
domain targets the CMS; the admin carries the product's name and mark.

**Done when**
- on stage and prod, the console URL, its old paths and `/auth/callback`
  answer 308 into the CMS, and following it lands on the staff sign-in
- on stage and prod, the CMS root still renders the academy's catalogue

## LX4 — the record

`AGENTS.md`, `README.md`, `ai/context/operations.md`, the CMS and console
docs, and this epic's status reading shipped.

**Done when**
- merged, and the operations guide alone explains how staff and learners
  each sign in

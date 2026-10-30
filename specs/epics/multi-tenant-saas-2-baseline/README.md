# Epic: multi-tenant-saas-2-baseline (LMB)

**multi-tenant-saas-2 is a live product: a multi-tenant learning platform on
Payload CMS — academies, courses, lessons, quizzes, learners with their own
accounts, progress and certificates — whose admin is the staff console. This
epic makes it a baseline too — "a Blueprint of itself", at the quality of the
Lumen baseline it was born from — so a new learning platform of the same shape
is one build away, registered on Orunbase as the public platform
"Multi-tenant LMS".**

It is the second baseline built this way, after sourceplane/lumen-payload's
`lumen-payload-baseline` (PB), whose design it shares file for file: the same
build, the same rebrand engine (its left-hand side is this repository's own
`.rebrand/values.json`), the same gates. What differs is only what the CMS
serves — the learning platform — and the identity.

The idea that makes it more than a copy of Lumen's template layer: the CMS's
code names the platform `lumen` in every case-form — `lib/lumen/`,
`/auth/lumen/*`, `LumenLogin`, `lumenUserId`, the `lumen_user_id` column,
`LUMEN_API`, a migration called `320_cms_lumen_identity` — so the rebrand has
to rename code, paths included, and keep the pieces that must agree agreeing.
So the baseline's own CI places a product, brands it, and runs that product's
typecheck and every suite.

## Status

| Field | Value |
|-------|-------|
| Status | In progress (2026-10-30) |
| Cluster | **LMB** (LMB-1, LMB-2) |
| Owner(s) | the factory layer (`repo-blueprint.yaml`, `blueprint.yaml`, `tooling/rebrand/`, `testing/`, `docs/phases/`, `.baseline/product/`); `apps/cms` (one dependency edge); `tests/cms`, `tests/platform-limits` (one rename, one recorded depth) |
| Builds on | the Lumen baseline at `baseline-v32` (this repository's parent), `multi-tenant-saas-2-lms` (LMS), `multi-tenant-saas-2-console` (LX), and lumen-payload's `lumen-payload-baseline` (PB) |
| Decisions locked | (1) **Lumen's phase names, not new ones**: the CMS's data plane lands in 03 and 03-db beside the fleet's, and the CMS lands in `06-console`, because it IS the console. (2) **One rebrand engine for every baseline built this way**: its left-hand side is this repository's own `.rebrand/values.json`. (3) **The platform word is renamed everywhere, paths included**, to the product's own name. (4) **A product's code must still build**: the baseline's CI installs, typechecks and tests a placed, branded product. (5) **The build time is derived, not measured**, and says so (no test build was run, by the owner's choice). |
| Gate | LMB-1 merged with Baseline CI green; `baseline-v1` cut by `tag.yml`; the registry row public, free, kind platform. |

## Read order

1. `design.md` — the shape of the baseline, the rebrand, the gates
2. `implementation-plan.md` — the milestones and what "done" means
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| LMB-1 — the template layer | the card, the build, the rebrand engine, the gates (Tier 0–2), the product templates, the docs, this spec | Baseline CI green on the PR; merged |
| LMB-2 — tagged and registered | `baseline-v1`; the orun-cloud registry row and the Orunbase platform page | the tag exists; the row is public at `baseline-v1` |

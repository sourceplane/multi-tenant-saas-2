# Implementation plan — multi-tenant-saas-2-baseline

## LMB-1 — the template layer

One pull request, because the pieces are one system: the build names the
rebrand, the gates read the build, the card is held to the build.

- `repo-blueprint.yaml` and `blueprint.yaml` from Lumen `baseline-v32`, with
  the CMS's four modules, the R2 token, the CMS probes, the deployment stub as
  a template, and no console-artifact hooks.
- `tooling/rebrand/` — the engine of design §3; `tooling/bootstrap/`,
  `hooks/render-deployment-docs.sh` (CMS rows).
- `testing/` — Lumen's gates adapted, `rebrand.test.sh` rewritten for the
  engine, `branded-fork.test.sh` new; `.github/workflows/baseline.yml` (three
  jobs) and `tag.yml` (the cut only).
- `.baseline/product/` — the product's README, AGENTS.md and deployment stub,
  from this repository's own pages.
- Docs: `BOOTSTRAP.md`, `docs/phases/` (06-console rewritten for the CMS,
  TIMINGS with the derived 23), `docs/components/REVIEW.md` regenerated for 49
  components, README and AGENTS.md sections on the baseline.
- Product fixes Tier 2 found: `apps/cms` declares `contracts`;
  `tests/platform-limits` records the CMS's chain depth; one test variable
  renamed.

**Done when** every gate passes locally (orun v2.89.0) and in Baseline CI, and
the PR is merged with the product's own CI green.

## LMB-2 — tagged and registered

- `tag.yml` cuts `baseline-v1` from `main`.
- orun-cloud: the registry row (`multi-tenant-saas-2`, public, free, the card at
  `blueprint.yaml`), the vendored card fixture and its tests, the docs overview
  and the generated facts; then the Orunbase platform page.

**Done when** the tag exists and the row is public at `baseline-v1`.

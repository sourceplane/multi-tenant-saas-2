# Implementation status — multi-tenant-saas-2-baseline

## LMB-1 — the template layer — in review

Verified locally with orun v2.89.0 (built from its tag):

| gate | result |
|---|---|
| manifest, phases, coverage, rebrand, retouch, bootstrap-defer, fleet-stubs, pen-reset | pass |
| leak | pass — no factory path, the context pack exactly two files |
| placement | pass — 01 → 08 through the rebrand, `--resume` keeps the branding |
| branded-fork | pass — 254 files rewritten and 41 paths renamed; a frozen install, every package typechecked, every Worker config rendered, every suite (30 test tasks) green |

Found by Tier 2 and fixed in this change — the same four lumen-payload's found,
since the CMS layer was ported from it: a test variable named `lumen`, the
migration checksum (the rebrand rewrites 320, the column it adds), the CMS's
undeclared `contracts` edge, and the unrecorded chain depth since the CMS's
staff sign-in binding.

## LMB-2 — tagged and registered — not started

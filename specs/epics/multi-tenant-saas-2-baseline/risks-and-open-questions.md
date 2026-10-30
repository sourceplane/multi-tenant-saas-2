# Risks and open questions — multi-tenant-saas-2-baseline

| id | risk | status |
|---|---|---|
| LMB-A | **The build time is not measured.** No test build was run (the owner's choice). 23 is Lumen's measured phases plus this repository's measured CMS deploys. | Open — the first real bootstrap replaces TIMINGS' derived section with its run. |
| LMB-B | **A bare `lumen` in an identifier position** becomes a slug, which is not an identifier (`const lumen` → `const acme-cloud`). | Mitigated — the one case is renamed; Tier 2 typechecks every package of a branded product; AGENTS.md says so. |
| LMB-C | **A rewritten migration's checksum.** The runner refuses a file whose hash is not its manifest's. | Resolved — the rebrand re-seals what it rewrote, and only that; tested. |
| LMB-D | **26 components verify on `quick-check`, which runs no tests**, so a product's own CI does not run most suites (inherited from Lumen; it hid two failures here). | Open, deliberately — flipping them is its own change. Tier 2 runs every suite of a placed product, so a product is not born red. |
| LMB-E | **The first admin needs the owner.** A product's CMS opens to nobody until its owner sets `CMS_SETUP_TOKEN`. | By design — documented in BOOTSTRAP §4, the product README and the CMS runbook. |
| LMB-F | **R2 must be enabled on the Cloudflare account** before the first bucket, and the connection's token must carry R2 Storage Write for `r2-data`. | Documented — BOOTSTRAP §0, docs/phases/03, troubleshooting. |
| LMB-G | **A product named so its PascalCase form is not an identifier** (`2 Acme`). | Resolved — the rebrand refuses it before writing. |

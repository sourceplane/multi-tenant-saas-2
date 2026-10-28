# cms-tests — architecture

A `turbo-package` component on the `verify` profile in `dev` only.

- **Jest, ESM, ts-jest**, the same preset as the other suites under `tests/`.
- **`@cms/*`** maps to `apps/cms/src/*`: the suite imports the CMS's own
  modules, not copies.
- **`payload` is stubbed** (`src/stubs/payload.ts`, one `APIError` class).
  The modules under test import only types from Payload, plus `APIError`, so
  the suite checks the CMS's rules without booting Payload. `tsc` still checks
  the types against the real package.
- **No database.** The live checks (a fresh database from migration 200, the
  gate, publishing, anonymous reads, concurrency) are the CMS's smoke test and
  the local run in `apps/cms/docs/runbook.md`.
- **Uncached** (`turbo.json`): turbo would otherwise key the result on this
  package alone and miss changes in `apps/cms`.
- **The suite runs in the package's `build` script** (`tsc --noEmit && jest`).
  In stack-tectonic 0.20.0 turbo-package ignores `preBuildCommand`,
  `buildCommand` and `typecheckCommand` (each guard reads the wrong variable)
  and always runs `turbo run build --filter=./`.

# web-console-next-tests — architecture

Jest (ts-jest, ESM) over `apps/web-console-next/src/worker.ts`, imported as
`@web-console-next/worker`. The Worker is pure (a URL in, a redirect out), so
the tests call `redirectFor`, `cmsPath` and the default `fetch` directly; no
Workers runtime is needed.

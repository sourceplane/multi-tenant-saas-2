# cms-tests — runbook

## Run it

```bash
pnpm --filter @saas/cms-tests test
pnpm --filter @saas/cms-tests typecheck
```

## When it fails

- **migration-sync**: a Payload migration changed or was added without its
  converted SQL. Run `node apps/cms/scripts/payload-migration-to-sql.mjs
  apps/cms/payload-migrations/<file>.ts > packages/db/src/migrations/<id>/up.sql`,
  update the checksum in `packages/db/src/manifest.ts`, and add the pair to
  `CONVERTED` in `src/migration-sync.test.ts`.
- **wrangler-config**: the template lost a binding, gained a committed id, or
  changed `main`/`assets` away from the OpenNext outputs.
- **access / users / lumen-***: a collection's rules or the sign-in changed. If that was deliberate,
  update the test together with `apps/cms/docs/architecture.md`.

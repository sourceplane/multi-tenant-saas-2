# web-console-next-tests — runbook

```bash
pnpm --filter @saas/web-console-next-tests test
pnpm --filter @saas/web-console-next-tests typecheck
```

A failure means the redirect map changed: if that was deliberate, update the
table in `src/redirect.test.ts` and `apps/web-console-next/docs/overview.md`
with `ROUTES` in `apps/web-console-next/src/worker.ts`.

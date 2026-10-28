# web-console-next — runbook

## How it deploys

A merge to `main` that changes `apps/web-console-next` deploys stage, then
prod, after the CMS. The build compiles the Worker and runs
`tests/web-console-next`; the smoke check asserts that
`/orgs/x/settings/billing?checkout=complete` answers `308` to the CMS billing
page of the same environment, and that following `/login` lands on the CMS's
Lumen sign-in view.

## Verify

```bash
C=https://multi-tenant-saas-2-web-console-next-stage.nexo-7be.workers.dev
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $C/            # 308 …-cms-stage…/admin
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$C/auth/callback?x=1"   # 308 …/auth/lumen/callback?x=1
```

## Change where an old page goes

Edit `ROUTES` in `src/worker.ts` and the table in `tests/web-console-next`
together.

## Common failures

- **Smoke: "308 …" did not match.** The CMS Worker name or the account's
  workers.dev subdomain changed: `CMS_WORKER_PREFIX` in `src/worker.ts` and
  `workersDevSubdomain` in `component.yaml` must match the CMS.
- **Smoke: the final page does not name `LumenSignIn`.** The CMS is down,
  answering an error, or its sign-in view was renamed; see
  `apps/cms/docs/runbook.md`.

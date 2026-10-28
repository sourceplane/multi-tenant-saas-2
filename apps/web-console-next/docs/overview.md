# web-console-next

The Lumen console's old URL, kept as a redirect to the Payload admin, which is
the product's console now (multi-tenant-saas-2-console LX3, after lumen-payload-console PX4).

| | stage | prod |
|---|---|---|
| URL | https://multi-tenant-saas-2-web-console-next-stage.nexo-7be.workers.dev | https://multi-tenant-saas-2-web-console-next-prod.nexo-7be.workers.dev |
| Goes to | https://multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev/admin | https://multi-tenant-saas-2-cms-prod.nexo-7be.workers.dev/admin |

## Where each old page goes

| Old console path | In the CMS |
|---|---|
| `/`, and anything not below | `/admin` |
| `/login` | `/admin/login` |
| `/auth/callback` (the OAuth return) | `/auth/lumen/callback` (the browser keeps the `#token` fragment) |
| `/account`, `/account/security` | `/admin/account`, `/admin/account/security` |
| `/orgs`, `/orgs/<slug>`, `/orgs/<slug>/settings` | `/admin/organization` |
| `/orgs/<slug>/settings/notifications` | `/admin/organization/notifications` |
| `/orgs/<slug>/settings/billing` (and `…/change-plan`, `/orgs/<slug>/billing`) | `/admin/organization/billing` |

The query string is kept (a billing return's `?checkout=complete` still
reconciles the plan).

## Depends on

- **cms**: the redirect's target; the deploy's smoke check follows the
  redirect to the CMS sign-in page.

## Verified by

- **web-console-next-tests** (the redirect map, run in this component's own
  build) and the deploy's smoke check.

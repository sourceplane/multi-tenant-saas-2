# web-console-next — architecture

One plain Worker, `src/worker.ts`, compiled by `tsc` to `dist/worker.js` and
deployed by the `cloudflare-workers-assets-turbo` composition as
`multi-tenant-saas-2-web-console-next-<env>`. No bindings, no static assets, no
state.

```
browser ──► multi-tenant-saas-2-web-console-next-<env> ──308──► multi-tenant-saas-2-cms-<env>/<mapped path>?<same query>
```

## Decisions

- **The environment comes from the host.** The Worker serves only
  `multi-tenant-saas-2-web-console-next-(dev|stage|prod).<subdomain>.workers.dev` and
  sends each to the CMS of the same environment on the same subdomain. Any
  other host answers 404, so the Worker cannot be made to redirect anywhere
  else.
- **308, cached an hour.** 308 keeps the method (an old form post still
  arrives as a post), and an hour's cache lets the mapping change without
  browsers holding a permanent redirect forever.
- **Same lane as before.** The component keeps its isolated lane and its
  Worker name, so nothing else in the plan moves.

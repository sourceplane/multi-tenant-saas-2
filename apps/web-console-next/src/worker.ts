// The Lumen console's URL, kept so bookmarks and old links still work
// (multi-tenant-saas-2-console LX3, after lumen-payload-console PX4, design §5): the product's console is the Payload
// admin now, so every request answers 308 with the same page's place in the
// CMS of the same environment. Nothing else runs here.

/** Worker name prefix of the CMS (apps/cms), per environment: `${prefix}-${env}`. */
export const CMS_WORKER_PREFIX = 'multi-tenant-saas-2-cms'

/** This Worker's own workers.dev host: multi-tenant-saas-2-web-console-next-<env>.<subdomain>.workers.dev. */
const OWN_HOST = /^multi-tenant-saas-2-web-console-next-(dev|stage|prod)\.([a-z0-9-]+)\.workers\.dev$/

/** Old console paths and where they live in the admin; anything else opens the admin. */
const ROUTES: Array<[RegExp, string]> = [
  [/^\/auth\/callback\/?$/, '/auth/lumen/callback'],
  [/^\/login\/?$/, '/admin/login'],
  [/^\/account\/?$/, '/admin/account'],
  [/^\/account\/security\/?$/, '/admin/account/security'],
  [/^\/orgs\/[^/]+\/(settings\/)?billing(\/change-plan)?\/?$/, '/admin/organization/billing'],
  [/^\/orgs\/[^/]+\/settings\/notifications\/?$/, '/admin/organization/notifications'],
  [/^\/orgs(\/[^/]+(\/settings)?)?\/?$/, '/admin/organization'],
]

/** The admin path for an old console path. */
export function cmsPath(pathname: string): string {
  for (const [pattern, target] of ROUTES) if (pattern.test(pathname)) return target
  return '/admin'
}

/**
 * Where a request goes: the same environment's CMS, the mapped path, the query
 * kept (the OAuth return's fragment is kept by the browser itself). Null for a
 * host this Worker does not serve.
 */
export function redirectFor(url: URL): string | null {
  const match = OWN_HOST.exec(url.hostname)
  if (!match) return null
  const [, environment, subdomain] = match
  return `https://${CMS_WORKER_PREFIX}-${environment}.${subdomain}.workers.dev${cmsPath(url.pathname)}${url.search}`
}

export default {
  fetch(request: Request): Response {
    const location = redirectFor(new URL(request.url))
    if (!location) return new Response('Not found\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    // 308 keeps the method; an hour's cache lets the mapping change later.
    return new Response(null, { status: 308, headers: { location, 'cache-control': 'public, max-age=3600' } })
  },
}

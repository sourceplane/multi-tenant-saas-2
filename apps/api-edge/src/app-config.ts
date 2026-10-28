// Instance identity for api-edge (saas-bootstrap-factory BF3 seam).
//
// Every deployment-identity literal this Worker needs lives here, so a new
// instance of the starter retargets one file (or, later, one generated
// config) instead of hunting through handler code. Do not add behavior —
// values and trivial derivations only.

/** The Cloudflare account's workers.dev subdomain serving this instance. */
export const WORKERS_DEV_SUBDOMAIN = "nexo-7be";

/** Worker name prefix of the console delivery (per-env: `${prefix}-${env}`). */
export const CONSOLE_WORKER_PREFIX = "multi-tenant-saas-2-web-console-next";

/** workers.dev origin of the console for a given environment name. */
export function consoleWorkersDevOrigin(environment: string): string {
  return `https://${CONSOLE_WORKER_PREFIX}-${environment}.${WORKERS_DEV_SUBDOMAIN}.workers.dev`;
}

/**
 * Worker name prefix of the Payload CMS (apps/cms), which is becoming the
 * console (specs/epics/multi-tenant-saas-2-console): its sign-in page calls the
 * auth routes from the browser.
 */
export const CMS_WORKER_PREFIX = "multi-tenant-saas-2-cms";

/** workers.dev origin of the CMS for a given environment name. */
export function cmsWorkersDevOrigin(environment: string): string {
  return `https://${CMS_WORKER_PREFIX}-${environment}.${WORKERS_DEV_SUBDOMAIN}.workers.dev`;
}

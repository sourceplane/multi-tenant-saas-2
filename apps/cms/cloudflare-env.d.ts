/// <reference types="@cloudflare/workers-types" />
// The bindings the CMS Worker receives (wrangler.template.jsonc).
interface CloudflareEnv {
  ASSETS: Fetcher
  HYPERDRIVE_CMS: Hyperdrive
  /** The media bucket (stage and prod only; infra/terraform/cloudflare-r2-cms). */
  R2_MEDIA?: R2Bucket
  ENVIRONMENT: string
  /** api-edge, over a service binding: the CMS server's way to Lumen (stage and prod). */
  LUMEN_API?: Fetcher
  /** api-edge's public URL, which the browser calls to sign in. */
  LUMEN_API_PUBLIC_URL?: string
  /** api-edge's URL for a local run without the binding. */
  LUMEN_API_URL?: string
  PAYLOAD_SECRET?: string
  CMS_SETUP_TOKEN?: string
}

/// <reference types="@cloudflare/workers-types" />
// The bindings the CMS Worker receives (wrangler.template.jsonc).
interface CloudflareEnv {
  ASSETS: Fetcher
  HYPERDRIVE_CMS: Hyperdrive
  /** The media bucket (stage and prod only; infra/terraform/cloudflare-r2-cms). */
  R2_MEDIA?: R2Bucket
  ENVIRONMENT: string
  PAYLOAD_SECRET?: string
  CMS_SETUP_TOKEN?: string
}

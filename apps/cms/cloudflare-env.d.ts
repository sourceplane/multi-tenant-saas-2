/// <reference types="@cloudflare/workers-types" />
// The bindings the CMS Worker receives (wrangler.template.jsonc).
interface CloudflareEnv {
  ASSETS: Fetcher
  HYPERDRIVE_CMS: Hyperdrive
  ENVIRONMENT: string
  PAYLOAD_SECRET?: string
  CMS_SETUP_TOKEN?: string
}

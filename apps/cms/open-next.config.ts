// The CMS binds nothing for OpenNext's caches (no R2 incremental cache, no
// queue): every page is dynamic, so the in-memory defaults are correct and
// keep the build hermetic.
import { defineCloudflareConfig } from '@opennextjs/cloudflare/config'

export default defineCloudflareConfig({})

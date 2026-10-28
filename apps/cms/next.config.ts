import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Payload's own `with-cloudflare-d1` template config at v3.89.0, plus what the
// Postgres adapter needs on workerd. `pg-cloudflare` exports its socket only
// under the `workerd` condition and an EMPTY module by default; webpack builds
// the server for Node, so if it bundles `pg`, `pg`'s require of the socket
// shim resolves to the empty module and every connection fails with
// "CloudflareSocket is not a constructor". Keeping `pg` and `pg-cloudflare`
// external defers them to OpenNext's esbuild pass, which resolves `workerd`.
// Both are direct dependencies of this package for the same reason: under
// pnpm, Next externalizes only what it can resolve from the app directory,
// and silently bundles anything it cannot.
const nextConfig: NextConfig = {
  // The composition runs `opennextjs-cloudflare build --skipBuild`, so the
  // standalone output the adapter bundles from must be asked for here — and
  // traced from the monorepo root so workspace dependencies are included.
  // Same two settings as apps/web-console-next.
  output: 'standalone',
  outputFileTracingRoot: path.join(dirname, '../..'),
  serverExternalPackages: ['jose', 'pg', 'pg-cloudflare'],
  // Nobody frames the CMS (lumen-payload-console design §6): sibling Workers
  // on the same workers.dev site get the Lax session cookie, so a framed
  // admin page could be clicked through from one of them.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })

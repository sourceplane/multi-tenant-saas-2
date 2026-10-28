import { getCloudflareContext } from '@opennextjs/cloudflare'

import { isWorkersRuntime } from '../runtime'
import type { LumenTransport } from './client'

// How the CMS server reaches api-edge. On Workers, the LUMEN_API service
// binding: the call stays inside Cloudflare and api-edge authenticates it by
// its bearer token like any other client. Off Workers (local `next dev`, a
// local `wrangler dev` without the binding), LUMEN_API_URL.
export async function lumenTransport(): Promise<LumenTransport> {
  if (isWorkersRuntime()) {
    const { env } = await getCloudflareContext({ async: true })
    const binding = (env as { LUMEN_API?: { fetch(url: string, init?: RequestInit): Promise<Response> } }).LUMEN_API
    if (binding) return (path, init) => binding.fetch(`https://lumen-api${path}`, init)
  }
  const base = process.env.LUMEN_API_URL
  if (!base) {
    return async () => {
      throw new Error('The CMS has no way to reach Lumen: the LUMEN_API binding (or LUMEN_API_URL) is missing.')
    }
  }
  return (path, init) => fetch(`${base.replace(/\/+$/, '')}${path}`, init)
}

/** The api-edge URL the browser calls for sign-in (a Worker var; not a secret). */
export function lumenPublicApiUrl(): string {
  return (process.env.LUMEN_API_PUBLIC_URL ?? process.env.LUMEN_API_URL ?? '').replace(/\/+$/, '')
}

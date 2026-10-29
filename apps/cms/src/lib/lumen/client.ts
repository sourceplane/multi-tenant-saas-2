// Calls to Lumen's public API (api-edge), made by the CMS server. The
// transport is injected: on Workers it is the LUMEN_API service binding
// (lib/lumen/transport.ts), in tests a fake. Every response is api-edge's
// envelope: { data } on success, { error: { code, message } } on failure.

export type LumenTransport = (path: string, init: RequestInit) => Promise<Response>

export type LumenResult<T> =
  | { ok: true; status: number; data: T; cursor: string | null }
  | { ok: false; status: number; code: string; message: string }

export type LumenUser = { id: string; email: string; displayName: string | null; lastOrgSlug?: string | null }
export type LumenSessionResponse = { session: { id: string; expiresAt: string; createdAt?: string }; user: LumenUser }

export async function lumenCall<T>(
  transport: LumenTransport,
  path: string,
  options: { token?: string | null; method?: string; body?: unknown } = {},
): Promise<LumenResult<T>> {
  const headers = new Headers({ accept: 'application/json' })
  if (options.token) headers.set('authorization', `Bearer ${options.token}`)
  const init: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json')
    init.body = JSON.stringify(options.body)
  }
  let response: Response
  try {
    response = await transport(path, init)
  } catch (error) {
    return { ok: false, status: 0, code: 'unreachable', message: error instanceof Error ? error.message : String(error) }
  }
  let parsed: unknown = null
  try {
    parsed = response.status === 204 ? null : await response.json()
  } catch {
    parsed = null
  }
  if (response.ok) {
    const envelope = parsed as { data?: T; meta?: { cursor?: string | null } } | null
    return { ok: true, status: response.status, data: (envelope?.data ?? null) as T, cursor: envelope?.meta?.cursor ?? null }
  }
  const error = (parsed as { error?: { code?: string; message?: string } } | null)?.error
  return { ok: false, status: response.status, code: error?.code ?? 'error', message: error?.message ?? `HTTP ${response.status}` }
}

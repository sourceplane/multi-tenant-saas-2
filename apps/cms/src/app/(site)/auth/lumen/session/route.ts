import { isSameOrigin, safeAdminRedirect, sessionCookie } from '@/lib/lumen/cookies'
import { resolveSession } from '@/lib/lumen/session'
import { lumenTransport } from '@/lib/lumen/transport'

export const dynamic = 'force-dynamic'

const noStore = { 'cache-control': 'no-store' }

async function fields(request: Request): Promise<{ token: string | null; redirect: string | null }> {
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { token?: unknown; redirect?: unknown }
    return {
      token: typeof body.token === 'string' ? body.token : null,
      redirect: typeof body.redirect === 'string' ? body.redirect : null,
    }
  }
  const form = await request.formData().catch((): FormData | null => null)
  const token = form?.get('token')
  const redirect = form?.get('redirect')
  return { token: typeof token === 'string' ? token : null, redirect: typeof redirect === 'string' ? redirect : null }
}

// The one place a Lumen token enters the CMS (design §1): the sign-in page
// posts it here once, the CMS checks it with api-edge, and keeps it in an
// httpOnly cookie from then on. Same-origin posts only.
export async function POST(request: Request): Promise<Response> {
  const self = new URL(request.url)
  if (!isSameOrigin(request.headers, request.url)) {
    return new Response('Sign-in must come from this site.\n', { status: 403, headers: { ...noStore, 'content-type': 'text/plain' } })
  }
  const { token, redirect } = await fields(request)
  const back = (error: string) => new Response(null, { status: 303, headers: { ...noStore, location: `/admin/login?error=${error}` } })
  if (!token) return back('missing')
  const session = await resolveSession(await lumenTransport(), token)
  if (!session) return back('invalid')
  return new Response(null, {
    status: 303,
    headers: {
      ...noStore,
      location: safeAdminRedirect(redirect),
      'set-cookie': sessionCookie(token, session.expiresAt, self.protocol === 'https:'),
    },
  })
}

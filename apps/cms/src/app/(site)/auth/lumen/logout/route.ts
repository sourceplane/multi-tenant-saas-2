import { isSameOrigin } from '@/lib/lumen/cookies'
import { endSession } from '@/lib/lumen/logout'
import { lumenTransport } from '@/lib/lumen/transport'

export const dynamic = 'force-dynamic'

// Sign out (design §1): revoke the Lumen session at api-edge, not just forget
// it, and remove the cookie. Same-origin posts only, so another site cannot
// sign a visitor out.
export async function POST(request: Request): Promise<Response> {
  const self = new URL(request.url)
  if (!isSameOrigin(request.headers, request.url)) {
    return new Response('Sign-out must come from this site.\n', { status: 403, headers: { 'cache-control': 'no-store', 'content-type': 'text/plain' } })
  }
  const { setCookie } = await endSession(await lumenTransport(), request.headers, self.protocol === 'https:')
  return new Response(null, {
    status: 303,
    headers: { 'cache-control': 'no-store', location: '/admin/login?signedOut=1', 'set-cookie': setCookie },
  })
}

import { MIN_SETUP_TOKEN_LENGTH, SETUP_CLOSED_MESSAGE, SETUP_COOKIE, setupIsOpen } from '@/lib/setup-gate'

export const dynamic = 'force-dynamic'

// The owner's door to the first admin (lumen-payload-cms design §4,
// lumen-payload-console design §3): /setup?token=<the CMS_SETUP_TOKEN secret
// they set>. A match sets a short-lived HttpOnly cookie and sends them to the
// Lumen sign-in with the token gone from the address bar. Whoever signs in
// with that cookie while no admin exists becomes the admin.
export function GET(request: Request): Response {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!setupIsOpen(process.env.CMS_SETUP_TOKEN, token)) {
    return new Response(`${SETUP_CLOSED_MESSAGE}\n(min ${MIN_SETUP_TOKEN_LENGTH} characters)\n`, {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  const cookie = [
    `${SETUP_COOKIE}=${encodeURIComponent(token as string)}`,
    'Path=/',
    'Max-Age=900',
    'HttpOnly',
    'SameSite=Strict',
    url.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
  return new Response(null, {
    status: 303,
    headers: { location: '/admin/login', 'set-cookie': cookie, 'cache-control': 'no-store' },
  })
}

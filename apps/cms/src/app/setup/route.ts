import { MIN_SETUP_TOKEN_LENGTH, SETUP_CLOSED_MESSAGE, SETUP_COOKIE, setupIsOpen } from '@/lib/setup-gate'

export const dynamic = 'force-dynamic'

// The owner's door into first-user setup (design §4): /setup?token=<the
// CMS_SETUP_TOKEN secret they set>. A match sets a short-lived HttpOnly cookie
// that the first-user gate on `users` accepts, and sends them to Payload's
// create-first-user form with the token gone from the address bar.
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
    headers: { location: '/admin/create-first-user', 'set-cookie': cookie, 'cache-control': 'no-store' },
  })
}

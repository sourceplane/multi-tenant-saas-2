import {
  clearedSessionCookie,
  isCrossSiteNonNavigation,
  isForeignOrigin,
  isSameOrigin,
  LUMEN_SESSION_COOKIE,
  MAX_SESSION_SECONDS,
  readCookie,
  safeAdminRedirect,
  sessionCookie,
} from '@cms/lib/lumen/cookies'

// The Lumen session cookie and the checks around it (lumen-payload-console
// design §1, §6).

describe('readCookie', () => {
  it('reads the named cookie and nothing else', () => {
    const headers = new Headers({ cookie: `a=1; ${LUMEN_SESSION_COOKIE}=sps_ses_x.y; ${LUMEN_SESSION_COOKIE}x=no` })
    expect(readCookie(headers, LUMEN_SESSION_COOKIE)).toBe('sps_ses_x.y')
    expect(readCookie(new Headers(), LUMEN_SESSION_COOKIE)).toBeNull()
    expect(readCookie(new Headers({ cookie: `${LUMEN_SESSION_COOKIE}=` }), LUMEN_SESSION_COOKIE)).toBeNull()
    expect(readCookie(new Headers({ cookie: `${LUMEN_SESSION_COOKIE}=%E0%A4%A` }), LUMEN_SESSION_COOKIE)).toBeNull()
  })
})

describe('sessionCookie', () => {
  const now = Date.parse('2026-10-28T12:00:00Z')

  it('is httpOnly, Lax, Path=/ and Secure on https, and lives until the session expires', () => {
    const cookie = sessionCookie('tok', '2026-10-29T12:00:00Z', true, now)
    expect(cookie).toContain(`${LUMEN_SESSION_COOKIE}=tok`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('Max-Age=86400')
    expect(cookie).not.toMatch(/Domain=/i)
  })

  it('never outlives 30 days, never goes negative, and drops Secure on http', () => {
    expect(sessionCookie('t', '2027-12-01T00:00:00Z', true, now)).toContain(`Max-Age=${MAX_SESSION_SECONDS}`)
    expect(sessionCookie('t', '2026-10-01T00:00:00Z', true, now)).toContain('Max-Age=0')
    expect(sessionCookie('t', null, false, now)).toContain(`Max-Age=${MAX_SESSION_SECONDS}`)
    expect(sessionCookie('t', null, false, now)).not.toContain('Secure')
  })

  it('clears with Max-Age=0', () => {
    expect(clearedSessionCookie(true)).toMatch(new RegExp(`^${LUMEN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure$`))
  })
})

describe('safeAdminRedirect', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/collections/pages', '/admin/collections/pages'],
    ['/admin?x=1', '/admin?x=1'],
  ])('keeps %s', (raw, expected) => expect(safeAdminRedirect(raw)).toBe(expected))

  it.each([null, '', 'https://evil.example/admin', '//evil.example/admin', '/administrator', '/api/users', '/admin\\@evil', '/admin\n'])(
    'sends %p to /admin',
    (raw) => expect(safeAdminRedirect(raw as string | null)).toBe('/admin'),
  )
})

describe('request origin checks', () => {
  it('refuses background requests from another site, not links followed from one', () => {
    expect(isCrossSiteNonNavigation(new Headers({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'cors' }))).toBe(true)
    expect(isCrossSiteNonNavigation(new Headers({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'no-cors' }))).toBe(true)
    expect(isCrossSiteNonNavigation(new Headers({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' }))).toBe(false)
    expect(isCrossSiteNonNavigation(new Headers({ 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' }))).toBe(false)
    expect(isCrossSiteNonNavigation(new Headers())).toBe(false)
  })

  it('a request naming another origin is foreign, a sibling Worker on the same site included', () => {
    const host = 'multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev'
    expect(isForeignOrigin(new Headers({ host, origin: `https://${host}` }))).toBe(false)
    expect(isForeignOrigin(new Headers({ host }))).toBe(false)
    expect(isForeignOrigin(new Headers({ host, origin: 'https://multi-tenant-saas-2-web-console-next-stage.nexo-7be.workers.dev' }))).toBe(true)
    expect(isForeignOrigin(new Headers({ host, origin: 'https://evil.example' }))).toBe(true)
    expect(isForeignOrigin(new Headers({ host, origin: 'null' }))).toBe(true)
    expect(isForeignOrigin(new Headers({ host, origin: 'not a url' }))).toBe(true)
    expect(isForeignOrigin(new Headers({ origin: `https://${host}` }))).toBe(true)
    expect(isForeignOrigin(new Headers({ host: '127.0.0.1:8799', origin: 'http://127.0.0.1:8799' }))).toBe(false)
  })

  it('same origin means exactly this origin', () => {
    const origin = 'https://multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev'
    const url = `${origin}/auth/lumen/session`
    expect(isSameOrigin(new Headers({ origin }), url)).toBe(true)
    expect(isSameOrigin(new Headers({ origin: 'https://multi-tenant-saas-2-web-console-next-stage.nexo-7be.workers.dev' }), url)).toBe(false)
    expect(isSameOrigin(new Headers(), url)).toBe(false)
  })

  it('also accepts the Host the browser used when the URL was rewritten (local wrangler dev)', () => {
    const url = 'http://localhost:8799/auth/lumen/session'
    expect(isSameOrigin(new Headers({ origin: 'http://127.0.0.1:8799', host: '127.0.0.1:8799' }), url)).toBe(true)
    expect(isSameOrigin(new Headers({ origin: 'https://evil.example', host: '127.0.0.1:8799' }), url)).toBe(false)
    expect(isSameOrigin(new Headers({ origin: 'https://127.0.0.1:8799', host: '127.0.0.1:8799' }), url)).toBe(false)
  })
})

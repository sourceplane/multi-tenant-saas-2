import worker, { cmsPath, redirectFor } from '@web-console-next/worker'

// The Lumen console's URL now opens the Payload admin (lumen-payload-console
// PX4, design §5): every old page lands on its place in the same
// environment's CMS.

const CONSOLE = 'https://multi-tenant-saas-2-web-console-next-stage.nexo-7be.workers.dev'
const CMS = 'https://multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev'

describe('the console redirect', () => {
  it.each([
    ['/', '/admin'],
    ['/orgs', '/admin/organization'],
    ['/orgs/personal-usr-1', '/admin/organization'],
    ['/orgs/personal-usr-1/settings', '/admin/organization'],
    ['/orgs/personal-usr-1/settings/billing', '/admin/organization/billing'],
    ['/orgs/personal-usr-1/settings/billing/change-plan', '/admin/organization/billing'],
    ['/orgs/personal-usr-1/billing', '/admin/organization/billing'],
    ['/orgs/personal-usr-1/settings/notifications', '/admin/organization/notifications'],
    ['/account', '/admin/account'],
    ['/account/security', '/admin/account/security'],
    ['/login', '/admin/login'],
    ['/auth/callback', '/auth/lumen/callback'],
    ['/orgs/x/projects/y', '/admin'],
    ['/anything/else', '/admin'],
  ])('sends %s to %s', (from, to) => expect(cmsPath(from)).toBe(to))

  it('goes to the same environment, keeping the query', () => {
    expect(redirectFor(new URL(`${CONSOLE}/orgs/a/settings/billing?checkout=complete`))).toBe(
      `${CMS}/admin/organization/billing?checkout=complete`,
    )
    expect(redirectFor(new URL('https://multi-tenant-saas-2-web-console-next-prod.nexo-7be.workers.dev/'))).toBe(
      'https://multi-tenant-saas-2-cms-prod.nexo-7be.workers.dev/admin',
    )
  })

  it('serves only its own hosts, so it can never send anyone elsewhere', () => {
    expect(redirectFor(new URL('https://evil.example/orgs'))).toBeNull()
    expect(redirectFor(new URL('https://multi-tenant-saas-2-web-console-next-stage.evil.workers.dev.example/'))).toBeNull()
    expect(redirectFor(new URL('https://multi-tenant-saas-2-web-console-next-qa.nexo-7be.workers.dev/'))).toBeNull()
  })

  it('answers 308 with the location, and 404 for a host it does not serve', () => {
    const res = worker.fetch(new Request(`${CONSOLE}/account`))
    expect([res.status, res.headers.get('location')]).toEqual([308, `${CMS}/admin/account`])
    expect(worker.fetch(new Request('https://evil.example/')).status).toBe(404)
  })

  it('keeps the method of a POST (308, not 301/302)', () => {
    expect(worker.fetch(new Request(`${CONSOLE}/login`, { method: 'POST' })).status).toBe(308)
  })
})

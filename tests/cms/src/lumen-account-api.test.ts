import { getPreferences, listOrganizations, listSecurityEvents, pickOrganization, updatePreferences, updateProfile } from '@cms/lib/lumen/account-api'
import type { LumenTransport } from '@cms/lib/lumen/client'

// The Lumen calls behind the account pages (lumen-payload-console design §4).

function fake(status: number, body: unknown) {
  const calls: { path: string; method: string; auth: string | null; body: unknown }[] = []
  const transport: LumenTransport = async (path, init) => {
    const headers = new Headers(init.headers)
    calls.push({ path, method: init.method ?? 'GET', auth: headers.get('authorization'), body: init.body ? JSON.parse(String(init.body)) : undefined })
    return new Response(JSON.stringify(body), { status })
  }
  return { transport, calls }
}

const org = (id: string) => ({ id, name: id, slug: id, createdAt: '2026-10-28T00:00:00Z' })

describe('account api', () => {
  it('sends the session token and reads the envelope', async () => {
    const f = fake(200, { data: { organizations: [org('org_1')] }, meta: { requestId: 'r' } })
    await expect(listOrganizations(f.transport, 'tok')).resolves.toEqual({ ok: true, value: [org('org_1')] })
    expect(f.calls).toEqual([{ path: '/v1/organizations', method: 'GET', auth: 'Bearer tok', body: undefined }])
  })

  it('passes the security-events cursor back as given and returns the next one from meta', async () => {
    const f = fake(200, { data: { securityEvents: [{ id: 'e1' }] }, meta: { requestId: 'r', cursor: 'b+/=' } })
    const page = await listSecurityEvents(f.transport, 'tok', 'a+/=')
    expect(f.calls[0]!.path).toBe('/v1/auth/security-events?cursor=a%2B%2F%3D')
    expect(page).toEqual({ ok: true, value: { events: [{ id: 'e1' }], nextCursor: 'b+/=' } })
    const last = fake(200, { data: { securityEvents: [] }, meta: { requestId: 'r', cursor: null } })
    await expect(listSecurityEvents(last.transport, 'tok')).resolves.toEqual({ ok: true, value: { events: [], nextCursor: null } })
    expect(last.calls[0]!.path).toBe('/v1/auth/security-events')
  })

  it('reports an api-edge error with its code', async () => {
    const f = fake(429, { error: { code: 'rate_limited', message: 'slow down' } })
    await expect(updateProfile(f.transport, 'tok', { displayName: 'A' })).resolves.toMatchObject({ ok: false, status: 429, code: 'rate_limited' })
    expect(f.calls[0]).toMatchObject({ path: '/v1/auth/profile', method: 'PATCH', body: { displayName: 'A' } })
  })

  it('reads and writes email preferences for the person in one organization', async () => {
    const g = fake(200, { data: { preferences: [] } })
    await getPreferences(g.transport, 'tok', 'org 1')
    expect(g.calls[0]!.path).toBe('/v1/notifications/preferences?orgId=org%201')
    const p = fake(200, { data: { preference: { orgId: 'org_1' } } })
    await updatePreferences(p.transport, 'tok', { orgId: 'org_1', userId: 'usr_1', categories: { billing: false } })
    expect(p.calls[0]).toMatchObject({
      path: '/v1/notifications/preferences',
      method: 'PUT',
      body: { orgId: 'org_1', subjectKind: 'user', subjectId: 'usr_1', channel: 'email', categories: { billing: false } },
    })
  })

  it('picks the organization asked for only among the person’s own, else their first', () => {
    const orgs = [org('a'), org('b')]
    expect(pickOrganization(orgs, 'b')?.id).toBe('b')
    expect(pickOrganization(orgs, 'someone-elses')?.id).toBe('a')
    expect(pickOrganization(orgs, undefined)?.id).toBe('a')
    expect(pickOrganization([], 'a')).toBeNull()
  })
})

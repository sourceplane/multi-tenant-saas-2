import { safeProviderUrl } from '@cms/lib/lumen/billing-api'
import type { LumenTransport } from '@cms/lib/lumen/client'
import { LUMEN_SESSION_COOKIE } from '@cms/lib/lumen/cookies'
import { billingForm, type FormDeps, type FormUser } from '@cms/lib/lumen/forms'
import { statusMessage } from '@cms/lib/lumen/status'

// Billing & plan's forms (lumen-payload-console design §4, PX3).

const ORIGIN = 'https://multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev'
const editor: FormUser = { id: 7, role: 'editor', lumenUserId: 'usr_ed', collection: 'users' }

function setup(answer: { status: number; body: unknown }, user: FormUser | null = editor) {
  const calls: { path: string; method: string; auth: string | null; body: unknown }[] = []
  const transport: LumenTransport = async (path, init) => {
    calls.push({ path, method: init.method ?? 'GET', auth: new Headers(init.headers).get('authorization'), body: init.body ? JSON.parse(String(init.body)) : undefined })
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }
  const deps: FormDeps = { transport: async () => transport, authenticate: async () => user }
  return { deps, calls }
}

const post = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/lumen/billing`, {
    method: 'POST',
    headers: { origin: ORIGIN, cookie: `${LUMEN_SESSION_COOKIE}=tok`, 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields).toString(),
  })

describe('billing form', () => {
  it('starts checkout with the CMS as the return, and sends the browser to the provider', async () => {
    const s = setup({ status: 200, body: { data: { checkoutUrl: 'https://sandbox.polar.sh/checkout/abc', mode: 'checkout' } } })
    const res = await billingForm(post({ action: 'checkout', orgId: 'org_1', planCode: 'pro' }), s.deps)
    expect([res.status, res.headers.get('location')]).toEqual([303, 'https://sandbox.polar.sh/checkout/abc'])
    expect(s.calls).toEqual([
      {
        path: '/v1/organizations/org_1/billing/checkout',
        method: 'POST',
        auth: 'Bearer tok',
        body: { planCode: 'pro', embedOrigin: ORIGIN, returnPath: '/admin/organization/billing?checkout=complete&org=org_1' },
      },
    ])
  })

  it('opens the customer portal', async () => {
    const s = setup({ status: 200, body: { data: { portalUrl: 'https://sandbox.polar.sh/portal/x' } } })
    const res = await billingForm(post({ action: 'portal', orgId: 'org_1' }), s.deps)
    expect(res.headers.get('location')).toBe('https://sandbox.polar.sh/portal/x')
    expect(s.calls[0]).toMatchObject({ path: '/v1/organizations/org_1/billing/portal', method: 'POST' })
  })

  it('never sends the browser to a provider URL that is not https', async () => {
    for (const url of ['javascript:alert(1)', 'http://polar.sh/x', '/admin', 'not a url']) {
      const s = setup({ status: 200, body: { data: { portalUrl: url } } })
      const res = await billingForm(post({ action: 'portal', orgId: 'org_1' }), s.deps)
      expect(res.headers.get('location')).toBe('/admin/organization/billing?org=org_1&error=bad_provider_url')
    }
  })

  it('changes, cancels and reconciles, coming back to the page with what happened', async () => {
    const change = setup({ status: 200, body: { data: { changed: true } } })
    expect((await billingForm(post({ action: 'change', orgId: 'org_1', planCode: 'business' }), change.deps)).headers.get('location')).toBe(
      '/admin/organization/billing?org=org_1&notice=plan_changed',
    )
    expect(change.calls[0]).toMatchObject({ path: '/v1/organizations/org_1/billing/subscription/change', body: { planCode: 'business' } })
    const cancel = setup({ status: 200, body: { data: { cancelAtPeriodEnd: true } } })
    expect((await billingForm(post({ action: 'cancel', orgId: 'org_1' }), cancel.deps)).headers.get('location')).toBe(
      '/admin/organization/billing?org=org_1&notice=cancel_scheduled',
    )
    const rec = setup({ status: 200, body: { data: { reconciled: false } } })
    expect((await billingForm(post({ action: 'reconcile', orgId: 'org_1' }), rec.deps)).headers.get('location')).toBe(
      '/admin/organization/billing?org=org_1&notice=nothing_to_reconcile',
    )
  })

  it('reports what billing refused, such as no provider on this environment', async () => {
    const s = setup({ status: 503, body: { error: { code: 'provider_unavailable', message: 'Billing provider not configured' } } })
    const res = await billingForm(post({ action: 'portal', orgId: 'org_1' }), s.deps)
    expect(res.headers.get('location')).toBe('/admin/organization/billing?org=org_1&error=provider_unavailable')
    expect(statusMessage({ error: 'provider_unavailable' })?.text).toMatch(/no payment provider/)
    expect(statusMessage({ notice: 'constructor' })).toBeNull()
    expect(statusMessage({ notice: 'reconciled' })?.kind).toBe('notice')
  })

  it('refuses unknown actions, a missing organization and odd plan codes without calling Lumen', async () => {
    for (const fields of [{ action: 'refund', orgId: 'org_1' }, { action: 'portal' }, { action: 'checkout', orgId: 'org_1', planCode: 'pro"><x' }]) {
      const s = setup({ status: 200, body: { data: {} } })
      const res = await billingForm(post(fields), s.deps)
      expect(res.headers.get('location')).toMatch(/error=bad_request/)
      expect(s.calls).toHaveLength(0)
    }
  })

  it('accepts posts only from the CMS and only from staff', async () => {
    const s = setup({ status: 200, body: { data: {} } })
    expect((await billingForm(post({ action: 'portal', orgId: 'org_1' }, { origin: 'https://evil.example' }), s.deps)).status).toBe(403)
    const pending = setup({ status: 200, body: { data: {} } }, { id: 8, role: null })
    expect((await billingForm(post({ action: 'portal', orgId: 'org_1' }), pending.deps)).headers.get('location')).toBe('/admin/unauthorized')
    expect([...s.calls, ...pending.calls]).toHaveLength(0)
  })
})

describe('safeProviderUrl', () => {
  it('keeps https and nothing else', () => {
    expect(safeProviderUrl('https://polar.sh/a?b=1')).toBe('https://polar.sh/a?b=1')
    expect(safeProviderUrl('http://polar.sh/a')).toBeNull()
    expect(safeProviderUrl(42)).toBeNull()
  })
})

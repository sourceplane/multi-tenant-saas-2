import type { LumenTransport } from '@cms/lib/lumen/client'
import { LUMEN_SESSION_COOKIE } from '@cms/lib/lumen/cookies'
import { backTo, categoriesFromForm, type FormDeps, type FormUser, notificationsForm, profileForm } from '@cms/lib/lumen/forms'
import { statusMessage } from '@cms/lib/lumen/status'

// The account pages' form handlers (lumen-payload-console design §4).

const ORIGIN = 'https://multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev'
const editor: FormUser = { id: 7, role: 'editor', lumenUserId: 'usr_ed', collection: 'users' }

function setup(user: FormUser | null = editor, answer: { status: number; body: unknown } = { status: 200, body: { data: { user: { id: 'usr_ed', email: 'ed@example.com', displayName: 'Ed' } } } }) {
  const calls: { path: string; method: string; auth: string | null; body: unknown }[] = []
  const names: unknown[] = []
  const transport: LumenTransport = async (path, init) => {
    calls.push({ path, method: init.method ?? 'GET', auth: new Headers(init.headers).get('authorization'), body: init.body ? JSON.parse(String(init.body)) : undefined })
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }
  const deps: FormDeps = {
    transport: async () => transport,
    authenticate: async () => user,
    syncName: async (id, name) => {
      names.push([id, name])
    },
  }
  return { deps, calls, names }
}

function post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, cookie: `${LUMEN_SESSION_COOKIE}=tok`, 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields).toString(),
  })
}

describe('account forms', () => {
  it('refuse a post from another origin, a sibling Worker included, and call nothing', async () => {
    const s = setup()
    const res = await profileForm(post('/lumen/profile', { displayName: 'X' }, { origin: 'https://multi-tenant-saas-2-web-console-next-stage.nexo-7be.workers.dev' }), s.deps)
    expect(res.status).toBe(403)
    expect(s.calls).toHaveLength(0)
  })

  it('send a signed-out visitor to the sign-in, and a pending account to the pending page', async () => {
    const out = await profileForm(post('/lumen/profile', {}, { cookie: '' }), setup().deps)
    expect([out.status, out.headers.get('location')]).toEqual([303, '/admin/login?redirect=%2Fadmin%2Faccount'])
    const pending = await profileForm(post('/lumen/profile', {}), setup({ id: 8, role: null, lumenUserId: 'usr_p' }).deps)
    expect(pending.headers.get('location')).toBe('/admin/unauthorized')
  })

  it('save the display name at Lumen with the session, copy it onto the users row, and say so', async () => {
    const s = setup()
    const res = await profileForm(post('/lumen/profile', { displayName: '  Ed  ' }), s.deps)
    expect([res.status, res.headers.get('location')]).toEqual([303, '/admin/account?saved=1'])
    expect(s.calls).toEqual([{ path: '/v1/auth/profile', method: 'PATCH', auth: 'Bearer tok', body: { displayName: 'Ed' } }])
    expect(s.names).toEqual([[7, 'Ed']])
  })

  it('clear the name when the field is empty, and refuse one that is too long without calling Lumen', async () => {
    const s = setup()
    await profileForm(post('/lumen/profile', { displayName: '   ' }), s.deps)
    expect(s.calls[0]!.body).toEqual({ displayName: null })
    const long = setup()
    const res = await profileForm(post('/lumen/profile', { displayName: 'x'.repeat(81) }), long.deps)
    expect(res.headers.get('location')).toBe('/admin/account?error=too_long')
    expect(long.calls).toHaveLength(0)
  })

  it('report what Lumen said when it refuses, and leave the users row alone', async () => {
    const s = setup(editor, { status: 422, body: { error: { code: 'validation_failed', message: 'no' } } })
    const res = await profileForm(post('/lumen/profile', { displayName: 'Ed' }), s.deps)
    expect(res.headers.get('location')).toBe('/admin/account?error=validation_failed')
    expect(s.names).toHaveLength(0)
  })

  it('save every email category for the organization as the person, ticked or not', async () => {
    const s = setup(editor, { status: 200, body: { data: { preference: {} } } })
    const res = await notificationsForm(post('/lumen/notifications', { orgId: 'org_1', billing: 'on', security: 'on' }), s.deps)
    expect(res.headers.get('location')).toBe('/admin/organization/notifications?org=org_1&saved=1')
    expect(s.calls[0]).toEqual({
      path: '/v1/notifications/preferences',
      method: 'PUT',
      auth: 'Bearer tok',
      body: {
        orgId: 'org_1',
        subjectKind: 'user',
        subjectId: 'usr_ed',
        channel: 'email',
        categories: { invitation: false, billing: true, security: true, support: false, product: false },
      },
    })
  })

  it('refuse a notifications form without an organization', async () => {
    const s = setup()
    const res = await notificationsForm(post('/lumen/notifications', { billing: 'on' }), s.deps)
    expect(res.headers.get('location')).toBe('/admin/organization/notifications?error=bad_request')
    expect(s.calls).toHaveLength(0)
  })

  it('read checkboxes as browsers send them: present and "on", or absent', () => {
    const form = new FormData()
    form.set('product', 'on')
    form.set('billing', 'yes')
    expect(categoriesFromForm(form)).toEqual({ invitation: false, billing: false, security: false, support: false, product: true })
  })
})

describe('status lines', () => {
  it('turn codes into sentences, and never echo markup', () => {
    expect(statusMessage({ saved: '1' })).toEqual({ kind: 'saved', text: 'Saved.' })
    expect(statusMessage({ error: 'too_long' })?.text).toMatch(/too long/)
    expect(statusMessage({ error: '<script>x</script>' })?.text).toBe('Lumen answered with an error (scriptxscript).')
    expect(statusMessage({})).toBeNull()
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(typeof statusMessage({ error: key })?.text).toBe('string')
    }
    expect(backTo('/admin/account', { error: 'a b' })).toBe('/admin/account?error=a+b')
  })
})

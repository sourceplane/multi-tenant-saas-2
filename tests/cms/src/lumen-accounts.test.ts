import { accountFor, type Account, type AccountStore } from '@cms/lib/lumen/accounts'

// Who a signed-in Lumen user is in the CMS (design §3): found by the link,
// linked by email once, or created. No role means pending; the first admin
// needs the owner's setup token.

function store(rows: Account[] = []) {
  let next = rows.length
  const s: AccountStore & { rows: Account[] } = {
    rows,
    findByLumenId: async (id) => rows.find((r) => r.lumenUserId === id) ?? null,
    findUnlinkedByEmail: async (email) => rows.find((r) => r.email === email.toLowerCase() && !r.lumenUserId) ?? null,
    adminExists: async () => rows.some((r) => r.role === 'admin'),
    create: async (data) => {
      if (rows.some((r) => r.lumenUserId && r.lumenUserId === data.lumenUserId)) throw new Error('unique')
      const row = { id: `u${++next}`, ...data, email: data.email.toLowerCase() }
      rows.push(row)
      return row
    },
    update: async (id, data) => {
      const row = rows.find((r) => r.id === id)!
      Object.assign(row, data)
      return row
    },
  }
  return s
}

const person = { id: 'usr_ed', email: 'Ed@Example.com', displayName: 'Ed' }

describe('accountFor', () => {
  it('returns the linked account', async () => {
    const s = store([{ id: 'u1', email: 'ed@example.com', role: 'editor', lumenUserId: 'usr_ed' }])
    await expect(accountFor(s, person, false)).resolves.toMatchObject({ id: 'u1', role: 'editor' })
    expect(s.rows).toHaveLength(1)
  })

  it('links an unlinked account with the same email once, keeping its role (an invitation)', async () => {
    const s = store([{ id: 'u1', email: 'ed@example.com', role: 'editor', lumenUserId: null }])
    await expect(accountFor(s, person, false)).resolves.toMatchObject({ id: 'u1', role: 'editor', lumenUserId: 'usr_ed' })
  })

  it('never re-links an account linked to someone else', async () => {
    const s = store([{ id: 'u1', email: 'ed@example.com', role: 'admin', lumenUserId: 'usr_other' }])
    let created = 0
    s.create = async () => {
      created++
      throw new Error('email taken')
    }
    await expect(accountFor(s, person, true)).rejects.toThrow('email taken')
    expect(created).toBe(1)
    expect(s.rows[0]).toMatchObject({ lumenUserId: 'usr_other', role: 'admin' })
  })

  it('creates a pending account (no role) for anyone new', async () => {
    const s = store()
    await expect(accountFor(s, person, false)).resolves.toMatchObject({ email: 'ed@example.com', name: 'Ed', role: null, lumenUserId: 'usr_ed' })
  })

  it('makes the first admin only with the setup token and only while no admin exists', async () => {
    const s = store()
    await expect(accountFor(s, person, true)).resolves.toMatchObject({ role: 'admin' })
    await expect(accountFor(s, { id: 'usr_2', email: 'two@example.com', displayName: null }, true)).resolves.toMatchObject({ role: null })
  })

  it('promotes a pending account through setup while there is no admin, and only then', async () => {
    const s = store([{ id: 'u1', email: 'ed@example.com', role: null, lumenUserId: 'usr_ed' }])
    await expect(accountFor(s, person, false)).resolves.toMatchObject({ role: null })
    await expect(accountFor(s, person, true)).resolves.toMatchObject({ role: 'admin' })
    const t = store([
      { id: 'u1', email: 'boss@example.com', role: 'admin', lumenUserId: 'usr_boss' },
      { id: 'u2', email: 'ed@example.com', role: null, lumenUserId: 'usr_ed' },
    ])
    await expect(accountFor(t, person, true)).resolves.toMatchObject({ role: null })
  })

  it('reads the row back when two first requests race to create it', async () => {
    const s = store()
    s.create = async (data) => {
      s.rows.push({ id: 'u9', ...data, email: data.email.toLowerCase() })
      throw new Error('unique violation')
    }
    await expect(accountFor(s, person, false)).resolves.toMatchObject({ id: 'u9' })
  })
})

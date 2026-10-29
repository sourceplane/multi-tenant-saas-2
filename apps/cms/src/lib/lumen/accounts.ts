import type { LumenUser } from './client'

// The Payload account of a signed-in Lumen user (design §3). Lumen says who
// someone is; the CMS keeps only what the content plane needs: the link
// (lumenUserId), a display name and a role. No role means pending: signed in,
// but not let into the admin until an admin gives them one.

export type Role = 'admin' | 'editor'
export type Account = { id: string; email: string; name?: string | null; role?: Role | null; lumenUserId?: string | null }

export type AccountStore = {
  findByLumenId(lumenUserId: string): Promise<Account | null>
  /** A row made before Lumen sign-in (or by an admin, as an invitation) with this email and no link yet. */
  findUnlinkedByEmail(email: string): Promise<Account | null>
  adminExists(): Promise<boolean>
  create(data: Omit<Account, 'id'>): Promise<Account>
  update(id: string, data: Partial<Omit<Account, 'id'>>): Promise<Account>
}

/**
 * Find, link or create the account, in that order. `setupOpen` is true when
 * the request carries the owner's setup token: while no admin exists, it makes
 * the person signing in the first admin. Without it nobody becomes admin by
 * signing in.
 */
export async function accountFor(store: AccountStore, user: LumenUser, setupOpen: boolean): Promise<Account> {
  let account = await store.findByLumenId(user.id)
  if (!account) {
    const unlinked = await store.findUnlinkedByEmail(user.email)
    if (unlinked) account = await store.update(unlinked.id, { lumenUserId: user.id })
  }
  if (!account) {
    const role: Role | null = setupOpen && !(await store.adminExists()) ? 'admin' : null
    try {
      account = await store.create({ email: user.email, name: user.displayName ?? null, lumenUserId: user.id, role })
    } catch (error) {
      // Two first requests of one person can race to create the row; the
      // unique link lets one win, and the other reads it back.
      const raced = await store.findByLumenId(user.id)
      if (!raced) throw error
      account = raced
    }
    return account
  }
  if (!account.role && setupOpen && !(await store.adminExists())) {
    account = await store.update(account.id, { role: 'admin' })
  }
  return account
}

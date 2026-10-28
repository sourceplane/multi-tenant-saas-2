import type { AdminViewServerProps } from 'payload'

// The admin's "unauthorized" view, replaced (design §3): who is signed in,
// and why they cannot go further yet.
export async function PendingAccess({ initPageResult }: AdminViewServerProps) {
  const user = initPageResult.req.user as { email?: string } | null
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <h1>Waiting for access</h1>
      {user?.email ? (
        <p>
          You are signed in as <strong>{user.email}</strong>, but nobody has given this account a role in the CMS yet. Ask
          an admin to open <em>Users</em> and make you an editor or an admin.
        </p>
      ) : (
        <p>You do not have access to this page.</p>
      )}
      <form method="post" action="/auth/lumen/logout">
        <button type="submit" className="btn btn--style-secondary btn--size-medium">
          Sign out
        </button>
      </form>
    </div>
  )
}

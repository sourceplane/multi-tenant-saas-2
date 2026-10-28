'use client'

import { useEffect, useRef } from 'react'

// The admin's logout view, replaced: the nav's log-out link lands here, and
// this posts to /auth/lumen/logout, which revokes the Lumen session.
export function LumenSignOut() {
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    form.current?.submit()
  }, [])
  return (
    <form ref={form} method="post" action="/auth/lumen/logout">
      <p>Signing you out…</p>
      <button type="submit" className="btn btn--style-secondary btn--size-medium">
        Sign out
      </button>
    </form>
  )
}

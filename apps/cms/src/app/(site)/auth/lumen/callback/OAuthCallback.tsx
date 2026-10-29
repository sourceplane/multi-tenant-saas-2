'use client'

import { useEffect, useRef, useState } from 'react'

// The codes identity-worker's OAuth callback sends back (#error=…).
const MESSAGES: Record<string, string> = {
  access_denied: 'The sign-in was cancelled.',
  missing_code: 'The provider did not finish the sign-in. Try again.',
  provider_unavailable: 'That sign-in provider is not available right now.',
  exchange_failed: 'The provider did not accept the sign-in. Try again.',
  identity_failed: 'The provider did not say who you are. Try again.',
  oauth_failed: 'The sign-in failed. Try again.',
  email_required: 'Your account with that provider has no email address.',
  email_unverified: 'Your account with that provider has no verified email address.',
  server_error: 'Something went wrong on our side. Try again.',
  missing: 'The sign-in did not return a session.',
}

// Reads the token from the fragment, removes it from the address bar and the
// history, and hands it to /auth/lumen/session in a same-origin form post.
export function OAuthCallback({ redirect }: { redirect: string }) {
  const form = useRef<HTMLFormElement>(null)
  const tokenInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    const token = fragment.get('token')
    if (token && form.current && tokenInput.current) {
      tokenInput.current.value = token
      form.current.submit()
      return
    }
    const code = fragment.get('error') ?? 'missing'
    setError(MESSAGES[code] ?? `The sign-in failed (${code}).`)
  }, [])

  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
      <form ref={form} method="post" action="/auth/lumen/session">
        <input ref={tokenInput} type="hidden" name="token" />
        <input type="hidden" name="redirect" value={redirect} />
      </form>
      {error ? (
        <>
          <p>{error}</p>
          <p>
            <a href="/admin/login">Back to sign-in</a>
          </p>
        </>
      ) : (
        <p>Signing you in…</p>
      )}
    </main>
  )
}

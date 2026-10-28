'use client'

import { Button } from '@payloadcms/ui'
import { useEffect, useRef, useState, type FormEvent } from 'react'

type Provider = { id: string; displayName: string }
type Envelope<T> = { data?: T; error?: { code?: string; message?: string } }

const ERRORS: Record<string, string> = {
  missing: 'The sign-in did not return a session. Try again.',
  invalid: 'That session is not valid any more. Sign in again.',
}

async function call<T>(url: string, body?: unknown): Promise<{ ok: boolean; data?: T; message?: string }> {
  try {
    const response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = (await response.json().catch(() => ({}))) as Envelope<T>
    if (response.ok) return { ok: true, data: json.data }
    return { ok: false, message: json.error?.message ?? `The request failed (${response.status}).` }
  } catch {
    return { ok: false, message: 'Lumen could not be reached. Check your connection and try again.' }
  }
}

// Sign in with a Lumen account (design §1). The browser talks to api-edge
// directly, as the Lumen console did: api-edge rate-limits sign-in per client
// IP. The token that comes back is posted once to /auth/lumen/session, which
// keeps it in an httpOnly cookie; this page does not store it.
export function LumenSignIn({
  apiUrl,
  redirect,
  error,
  signedOut,
  productName,
}: {
  apiUrl: string
  redirect: string
  error?: string | null
  signedOut?: boolean
  productName: string
}) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [emailHint, setEmailHint] = useState<string | null>(null)
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(error ? (ERRORS[error] ?? 'The sign-in failed. Try again.') : null)
  const sessionForm = useRef<HTMLFormElement>(null)
  const tokenInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!apiUrl) return
    void call<{ providers: Provider[] }>(`${apiUrl}/v1/auth/oauth/providers`).then((r) => {
      if (r.ok && r.data?.providers) setProviders(r.data.providers)
    })
  }, [apiUrl])

  const start = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    const r = await call<{ challengeId: string; delivery: { emailHint: string; code?: string } }>(`${apiUrl}/v1/auth/login/start`, { email })
    setBusy(false)
    if (!r.ok || !r.data) return setMessage(r.message ?? 'The code could not be sent.')
    setChallengeId(r.data.challengeId)
    setEmailHint(r.data.delivery.emailHint)
    setDebugCode(r.data.delivery.code ?? null)
    setStep('code')
  }

  const complete = async (event: FormEvent) => {
    event.preventDefault()
    if (!challengeId) return
    setBusy(true)
    setMessage(null)
    const r = await call<{ token: string }>(`${apiUrl}/v1/auth/login/complete`, { challengeId, code: code.trim() })
    if (!r.ok || !r.data?.token || !sessionForm.current || !tokenInput.current) {
      setBusy(false)
      return setMessage(r.message ?? 'That code did not work.')
    }
    tokenInput.current.value = r.data.token
    sessionForm.current.submit()
  }

  const oauthUrl = (provider: string) => {
    const back = `${window.location.origin}/auth/lumen/callback?redirect=${encodeURIComponent(redirect)}`
    return `${apiUrl}/v1/auth/oauth/${encodeURIComponent(provider)}/start?return_to=${encodeURIComponent(back)}`
  }

  const input = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    fontSize: '1rem',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'var(--theme-input-bg, var(--theme-elevation-0))',
    color: 'var(--theme-text)',
  } as const

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Sign in to {productName}</h1>
      <p style={{ color: 'var(--theme-elevation-600)', marginTop: 0 }}>Use your Lumen account. There is no separate CMS password.</p>
      {signedOut && !message && <p role="status">You are signed out.</p>}
      {message && (
        <p role="alert" style={{ color: 'var(--theme-error-500)' }}>
          {message}
        </p>
      )}

      <form ref={sessionForm} method="post" action="/auth/lumen/session" style={{ display: 'none' }}>
        <input ref={tokenInput} type="hidden" name="token" />
        <input type="hidden" name="redirect" value={redirect} />
      </form>

      {step === 'email' ? (
        <form onSubmit={start}>
          <label htmlFor="lumen-email">Email</label>
          <input
            id="lumen-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
          <Button type="submit" buttonStyle="primary" size="large" disabled={busy || !apiUrl}>
            {busy ? 'Sending…' : 'Email me a code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={complete}>
          <p>
            We sent a code to <strong>{emailHint ?? email}</strong>.
          </p>
          {debugCode && (
            <p data-testid="debug-code" style={{ color: 'var(--theme-elevation-600)' }}>
              Stage delivers the code here: <code>{debugCode}</code>
            </p>
          )}
          <label htmlFor="lumen-code">Code</label>
          <input
            id="lumen-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={input}
          />
          <Button type="submit" buttonStyle="primary" size="large" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <Button buttonStyle="subtle" size="small" onClick={() => setStep('email')} disabled={busy}>
            Use another email
          </Button>
        </form>
      )}

      {providers.length > 0 && step === 'email' && (
        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ color: 'var(--theme-elevation-600)' }}>Or continue with</p>
          {providers.map((p) => (
            <Button key={p.id} el="anchor" url={oauthUrl(p.id)} buttonStyle="secondary" size="large">
              {p.displayName}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

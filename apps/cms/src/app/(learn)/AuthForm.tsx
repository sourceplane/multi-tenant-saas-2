'use client'

import { useActionState } from 'react'

import type { FormState } from './actions'

type Field = { name: string; label: string; type: 'text' | 'email' | 'password'; autoComplete: string; hint?: string }

export function AuthForm({
  action,
  fields,
  submit,
  next,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>
  fields: Field[]
  submit: string
  next: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  return (
    <form className="stack" action={formAction}>
      {state.error ? (
        <p className="notice warn" role="alert">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="next" value={next} />
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.hint ? <span className="hint">{f.hint}</span> : null}
          <input name={f.name} type={f.type} autoComplete={f.autoComplete} required />
        </label>
      ))}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'One moment…' : submit}
      </button>
    </form>
  )
}

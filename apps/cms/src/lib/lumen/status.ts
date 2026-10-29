// What the account pages say after a form or a failed read (design §4).
// api-edge's error codes become sentences; anything unknown is reported as is.

const MESSAGES: Record<string, string> = {
  too_long: 'That name is too long. Keep it under 80 characters.',
  bad_request: 'The form was incomplete. Reload the page and try again.',
  unauthenticated: 'Your session ended. Sign in again.',
  forbidden: 'Your account is not allowed to do that.',
  not_found: 'Lumen does not have that any more. Reload the page.',
  rate_limited: 'Too many requests just now. Wait a minute and try again.',
  validation_failed: 'Lumen refused the change. Check the values and try again.',
  conflict: 'Something changed at the same time. Reload the page and try again.',
  internal_error: 'Lumen had a problem. Try again in a moment.',
  unreachable: 'The CMS could not reach Lumen. Try again in a moment.',
  provider_unavailable: 'Billing is not set up for this environment yet: no payment provider is configured.',
  plan_not_purchasable: 'That plan cannot be bought here. Contact sales, or pick another plan.',
  provider_error: 'The payment provider did not answer. Try again in a moment.',
  bad_provider_url: 'The payment provider sent back an address the CMS will not open.',
}

const NOTICES: Record<string, string> = {
  plan_changed: 'Your plan is changing. It can take a few seconds to show here.',
  plan_unchanged: 'You are already on that plan.',
  cancel_scheduled: 'Your plan is cancelled. It stays active until the end of the period you paid for.',
  canceled: 'Your plan is cancelled.',
  reconciled: 'Thanks: your new plan is in place.',
  nothing_to_reconcile: 'Thanks: the payment provider is applying your new plan. It can take a few seconds to show here.',
}

export type Status = { kind: 'saved' | 'error' | 'notice'; text: string }

export function statusMessage(query: {
  saved?: string | undefined
  error?: string | undefined
  notice?: string | undefined
}): Status | null {
  const notice = query.notice && Object.hasOwn(NOTICES, query.notice) ? NOTICES[query.notice] : undefined
  if (notice) return { kind: 'notice', text: notice }
  if (query.error) {
    const code = query.error.replace(/[^a-z0-9_.-]/gi, '').slice(0, 64)
    // Own keys only: `?error=constructor` must not reach the page as a function.
    const known = Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : undefined
    return { kind: 'error', text: known ?? `Lumen answered with an error (${code || 'unknown'}).` }
  }
  if (query.saved === '1') return { kind: 'saved', text: 'Saved.' }
  return null
}

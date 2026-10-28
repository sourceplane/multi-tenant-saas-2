import type {
  CancelSubscriptionResponse,
  ChangePlanResponse,
  CreateCheckoutResponse,
  CreatePortalSessionResponse,
  GetBillingSummaryResponse,
  ListInvoicesResponse,
  ListPlansResponse,
  PublicInvoice,
  PublicPlan,
  ReconcileResponse,
} from '@saas/contracts/billing'

import type { Outcome } from './account-api'
import { lumenCall, type LumenResult, type LumenTransport } from './client'

// The Lumen billing calls behind Billing & plan (lumen-payload-console design
// §4), made by the CMS server with the person's session for one organization:
// the same api-edge routes the console calls. Payment details never pass
// through the CMS: checkout and the portal are the provider's own pages.

const base = (orgId: string) => `/v1/organizations/${encodeURIComponent(orgId)}/billing`

// `=== false`, not `!ok`: the CMS compiles without strictNullChecks.
function unwrap<T, R>(result: LumenResult<T>, pick: (data: T) => R): Outcome<R> {
  if (result.ok === false) return result
  return { ok: true, value: pick(result.data) }
}

export async function getSummary(t: LumenTransport, token: string, orgId: string): Promise<Outcome<GetBillingSummaryResponse>> {
  return unwrap(await lumenCall<GetBillingSummaryResponse>(t, `${base(orgId)}/summary`, { token }), (d) => d)
}

export async function listPlans(t: LumenTransport, token: string, orgId: string): Promise<Outcome<PublicPlan[]>> {
  return unwrap(await lumenCall<ListPlansResponse>(t, `${base(orgId)}/plans`, { token }), (d) => d?.plans ?? [])
}

export async function listInvoices(t: LumenTransport, token: string, orgId: string): Promise<Outcome<PublicInvoice[]>> {
  return unwrap(await lumenCall<ListInvoicesResponse>(t, `${base(orgId)}/invoices`, { token }), (d) => d?.invoices ?? [])
}

/** A hosted checkout for `planCode`; the provider sends the buyer back to `returnUrl` (an origin and a path). */
export async function createCheckout(
  t: LumenTransport,
  token: string,
  orgId: string,
  input: { planCode: string; origin: string; returnPath: string },
): Promise<Outcome<CreateCheckoutResponse>> {
  const body = { planCode: input.planCode, embedOrigin: input.origin, returnPath: input.returnPath }
  return unwrap(await lumenCall<CreateCheckoutResponse>(t, `${base(orgId)}/checkout`, { token, method: 'POST', body }), (d) => d)
}

export async function createPortal(t: LumenTransport, token: string, orgId: string): Promise<Outcome<CreatePortalSessionResponse>> {
  return unwrap(await lumenCall<CreatePortalSessionResponse>(t, `${base(orgId)}/portal`, { token, method: 'POST' }), (d) => d)
}

export async function changePlan(t: LumenTransport, token: string, orgId: string, planCode: string): Promise<Outcome<ChangePlanResponse>> {
  return unwrap(
    await lumenCall<ChangePlanResponse>(t, `${base(orgId)}/subscription/change`, { token, method: 'POST', body: { planCode } }),
    (d) => d,
  )
}

export async function cancelSubscription(t: LumenTransport, token: string, orgId: string): Promise<Outcome<CancelSubscriptionResponse>> {
  return unwrap(await lumenCall<CancelSubscriptionResponse>(t, `${base(orgId)}/subscription/cancel`, { token, method: 'POST' }), (d) => d)
}

export async function reconcile(t: LumenTransport, token: string, orgId: string): Promise<Outcome<ReconcileResponse>> {
  return unwrap(await lumenCall<ReconcileResponse>(t, `${base(orgId)}/reconcile`, { token, method: 'POST' }), (d) => d)
}

/** A provider URL the CMS may send a browser to: https, nothing else. */
export function safeProviderUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

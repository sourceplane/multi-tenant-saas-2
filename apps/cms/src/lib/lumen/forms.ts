import type { NotificationCategoryPreferences } from '@saas/contracts/notifications'

import { staffRoleOf } from '../access'
import { updatePreferences, updateProfile } from './account-api'
import { cancelSubscription, changePlan, createCheckout, createPortal, reconcile, safeProviderUrl } from './billing-api'
import type { LumenTransport } from './client'
import { isSameOrigin, LUMEN_SESSION_COOKIE, readCookie } from './cookies'
import { DISPLAY_NAME_MAX, toDisplayNameValue, validateDisplayName } from './models/profile'
import { PREFERENCE_CATEGORIES } from './models/preferences'

// The CMS route handlers behind the account pages' forms (design §4): each
// accepts a same-origin form post from a signed-in admin or editor, calls
// api-edge with their session, and answers 303 back to the page with a
// status the page shows. Pure: the routes inject Payload and the transport.

export const ACCOUNT_PAGES = {
  profile: '/admin/account',
  security: '/admin/account/security',
  organization: '/admin/organization',
  notifications: '/admin/organization/notifications',
  billing: '/admin/organization/billing',
} as const

export type FormUser = { id: string | number; role?: string | null; lumenUserId?: string | null; collection?: string }

export type FormDeps = {
  transport: () => Promise<LumenTransport>
  /** The Payload user the request's cookie signs in, or null. */
  authenticate: (headers: Headers) => Promise<FormUser | null>
  /** Keep the CMS's copy of the display name in step (users.name). */
  syncName?: (userId: FormUser['id'], name: string | null) => Promise<void>
}

const seeOther = (location: string) =>
  new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } })

/** Where a form goes back to, with what happened. */
export function backTo(
  page: string,
  outcome: { saved: true } | { error: string } | { notice: string },
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams(extra)
  if ('saved' in outcome) params.set('saved', '1')
  else if ('notice' in outcome) params.set('notice', outcome.notice)
  else params.set('error', outcome.error)
  return `${page}?${params.toString()}`
}

type Action = (input: { form: FormData; token: string; user: FormUser; transport: LumenTransport }) => Promise<
  { location: string }
>

async function handle(request: Request, deps: FormDeps, page: string, action: Action): Promise<Response> {
  if (!isSameOrigin(request.headers, request.url)) {
    return new Response('Forbidden: this form only accepts posts from the CMS itself.\n', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  const token = readCookie(request.headers, LUMEN_SESSION_COOKIE)
  const user = token ? await deps.authenticate(request.headers) : null
  if (!token || !user) return seeOther(`/admin/login?redirect=${encodeURIComponent(page)}`)
  if (!staffRoleOf(user)) return seeOther('/admin/unauthorized')
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return seeOther(backTo(page, { error: 'bad_request' }))
  }
  const { location } = await action({ form, token, user, transport: await deps.transport() })
  return seeOther(location)
}

/** POST /lumen/profile: the display name. */
export function profileForm(request: Request, deps: FormDeps): Promise<Response> {
  const page = ACCOUNT_PAGES.profile
  return handle(request, deps, page, async ({ form, token, user, transport }) => {
    const raw = String(form.get('displayName') ?? '')
    if (!validateDisplayName(raw).ok) return { location: backTo(page, { error: 'too_long' }) }
    const displayName = toDisplayNameValue(raw)
    const result = await updateProfile(transport, token, { displayName })
    if (result.ok === false) return { location: backTo(page, { error: result.code }) }
    await deps.syncName?.(user.id, result.value.displayName ?? null)
    return { location: backTo(page, { saved: true }) }
  })
}

/** The categories a notifications form asks for: a ticked box delivers, an unticked one does not. */
export function categoriesFromForm(form: FormData): NotificationCategoryPreferences {
  const categories: NotificationCategoryPreferences = {}
  for (const { key } of PREFERENCE_CATEGORIES) categories[key] = form.get(key) === 'on'
  return categories
}

/** POST /lumen/notifications: email categories for one organization. */
export function notificationsForm(request: Request, deps: FormDeps): Promise<Response> {
  const page = ACCOUNT_PAGES.notifications
  return handle(request, deps, page, async ({ form, token, user, transport }) => {
    const orgId = String(form.get('orgId') ?? '')
    const back = orgId ? { org: orgId } : undefined
    if (!orgId || !user.lumenUserId) return { location: backTo(page, { error: 'bad_request' }, back) }
    const result = await updatePreferences(transport, token, {
      orgId,
      userId: user.lumenUserId,
      categories: categoriesFromForm(form),
    })
    return { location: backTo(page, result.ok === false ? { error: result.code } : { saved: true }, back) }
  })
}

/** Where the provider sends the buyer back to after checkout. */
export const CHECKOUT_RETURN = `${ACCOUNT_PAGES.billing}?checkout=complete`

const BILLING_ACTIONS = ['checkout', 'portal', 'change', 'cancel', 'reconcile'] as const
type BillingAction = (typeof BILLING_ACTIONS)[number]

/**
 * POST /lumen/billing: one organization's plan. Checkout and the portal answer
 * with the provider's page, which the browser is sent to (https only); a plan
 * change, a cancellation and a reconcile come back to Billing & plan.
 */
export function billingForm(request: Request, deps: FormDeps): Promise<Response> {
  const page = ACCOUNT_PAGES.billing
  return handle(request, deps, page, async ({ form, token, transport }) => {
    const action = String(form.get('action') ?? '') as BillingAction
    const orgId = String(form.get('orgId') ?? '')
    const planCode = String(form.get('planCode') ?? '')
    const back = orgId ? { org: orgId } : undefined
    if (!orgId || !BILLING_ACTIONS.includes(action)) return { location: backTo(page, { error: 'bad_request' }, back) }
    if ((action === 'checkout' || action === 'change') && !/^[a-z0-9_-]{1,64}$/.test(planCode)) {
      return { location: backTo(page, { error: 'bad_request' }, back) }
    }
    const fail = (code: string) => ({ location: backTo(page, { error: code }, back) })

    if (action === 'checkout') {
      // isSameOrigin passed, so Origin is the CMS as the browser sees it.
      const origin = request.headers.get('origin') as string
      const result = await createCheckout(transport, token, orgId, { planCode, origin, returnPath: `${CHECKOUT_RETURN}&org=${encodeURIComponent(orgId)}` })
      if (result.ok === false) return fail(result.code)
      const url = safeProviderUrl(result.value.checkoutUrl)
      return url ? { location: url } : fail('bad_provider_url')
    }
    if (action === 'portal') {
      const result = await createPortal(transport, token, orgId)
      if (result.ok === false) return fail(result.code)
      const url = safeProviderUrl(result.value.portalUrl)
      return url ? { location: url } : fail('bad_provider_url')
    }
    if (action === 'change') {
      const result = await changePlan(transport, token, orgId, planCode)
      if (result.ok === false) return fail(result.code)
      return { location: backTo(page, { notice: result.value.changed ? 'plan_changed' : 'plan_unchanged' }, back) }
    }
    if (action === 'cancel') {
      const result = await cancelSubscription(transport, token, orgId)
      if (result.ok === false) return fail(result.code)
      return { location: backTo(page, { notice: result.value.cancelAtPeriodEnd ? 'cancel_scheduled' : 'canceled' }, back) }
    }
    const result = await reconcile(transport, token, orgId)
    if (result.ok === false) return fail(result.code)
    return { location: backTo(page, { notice: result.value.reconciled ? 'reconciled' : 'nothing_to_reconcile' }, back) }
  })
}

export { DISPLAY_NAME_MAX }

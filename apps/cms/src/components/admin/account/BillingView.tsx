import type { PublicPlan } from '@saas/contracts/billing'
import type { AdminViewServerProps } from 'payload'

import { listOrganizations, pickOrganization } from '@/lib/lumen/account-api'
import { getSummary, listInvoices, listPlans } from '@/lib/lumen/billing-api'
import { formatPlanPrice, hasManageableSubscription, orderedPlans, planChangeAction, planFeatureLines } from '@/lib/lumen/models/plan-actions'
import { lumenTransport } from '@/lib/lumen/transport'

import { AccountHeading, AccountTemplate, card, LoadError, param, requireStaff, row, StatusLine } from './AccountPage'
import { ConfirmSubmit } from './ConfirmSubmit'
import { FinishCheckout } from './FinishCheckout'

// Billing & plan (lumen-payload-console design §4): the organization's plan,
// what it includes, its invoices, and the ways to change it. Paying happens on
// the provider's pages (checkout, the customer portal), never in the CMS.

const SALES_EMAIL = 'sales@sourceplane.ai'

const section = { marginTop: 'calc(var(--base) * 2)' }

const cell = { padding: 'calc(var(--base) / 2)', borderBottom: '1px solid var(--theme-elevation-100)', textAlign: 'left' as const }

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMoney(cents: number | null | undefined, currency: string): string {
  if (cents == null) return '—'
  const symbol = currency.toLowerCase() === 'usd' ? '$' : `${currency.toUpperCase()} `
  return `${symbol}${(cents / 100).toFixed(2)}`
}

function priceLabel(plan: PublicPlan): string {
  if (plan.billingInterval === 'none') return 'Custom: contact sales'
  if (!plan.priceAmountCents) return 'Free'
  return formatPlanPrice(plan)
}

function PlanButton({ plan, orgId, action }: { plan: PublicPlan; orgId: string; action: ReturnType<typeof planChangeAction> }) {
  if (action === 'current') return <strong data-testid={`plan-current-${plan.code}`}>Your plan</strong>
  if (action === 'contact')
    return (
      <a href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`${plan.name} plan enquiry`)}`} className="btn btn--style-secondary btn--size-small">
        Contact sales
      </a>
    )
  const label = action === 'checkout' ? `Upgrade to ${plan.name}` : action === 'cancel' ? 'Move to Free' : `Switch to ${plan.name}`
  const confirm =
    action === 'cancel'
      ? 'Cancel your paid plan? It stays active until the end of the period you paid for.'
      : action === 'change'
        ? `Switch to ${plan.name} (${formatPlanPrice(plan)})? The payment provider prorates the difference.`
        : null
  return (
    <form method="post" action="/lumen/billing" style={{ margin: 0 }}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="action" value={action === 'cancel' ? 'cancel' : action} />
      <input type="hidden" name="planCode" value={plan.code} />
      {confirm ? (
        <ConfirmSubmit message={confirm} className="btn btn--style-secondary btn--size-small" testId={`plan-${action}-${plan.code}`}>
          {label}
        </ConfirmSubmit>
      ) : (
        <button type="submit" className="btn btn--style-primary btn--size-small" data-testid={`plan-${action}-${plan.code}`}>
          {label}
        </button>
      )}
    </form>
  )
}

export async function BillingView(props: AdminViewServerProps) {
  const token = requireStaff(props, '/admin/organization/billing')
  const transport = await lumenTransport()
  const orgs = await listOrganizations(transport, token)
  const org = orgs.ok === true ? pickOrganization(orgs.value, param(props, 'org')) : null

  // Back from the provider's checkout: FinishCheckout reconciles once by form
  // post, so the page does not wait on the provider's webhook.
  const returning = param(props, 'checkout') === 'complete'

  const [summary, plans, invoices] = org
    ? await Promise.all([getSummary(transport, token, org.id), listPlans(transport, token, org.id), listInvoices(transport, token, org.id)])
    : [null, null, null]

  const plan = summary?.ok === true ? summary.value.plan : null
  const sub = summary?.ok === true ? summary.value.activeSubscription : null
  const currentCode = plan?.code ?? null
  const manageable = hasManageableSubscription(currentCode) && Boolean(sub?.providerSubscriptionId)
  const entitlements = summary?.ok === true ? summary.value.entitlements : []

  return (
    <AccountTemplate props={props}>
      <div data-testid="lumen-billing">
        <AccountHeading title="Billing & plan" description="Your organization's plan, what it includes, and its invoices." />
        <StatusLine props={props} />
        {returning && org ? <FinishCheckout orgId={org.id} /> : null}
        {orgs.ok === false ? (
          <LoadError code={orgs.code} />
        ) : !org ? (
          <p>Your account does not belong to an organization yet.</p>
        ) : summary?.ok === false ? (
          <LoadError code={summary.code} />
        ) : (
          <>
            <section style={card} data-testid="billing-summary">
              <h2 style={{ marginTop: 0 }} data-testid="plan-name">
                {plan ? plan.name : 'No plan'}
              </h2>
              <dl style={row}>
                <dt>Price</dt>
                <dd>{plan ? priceLabel(plan) : '—'}</dd>
                <dt>Status</dt>
                <dd data-testid="subscription-status">{sub?.status ?? 'none'}</dd>
                <dt>Renews on</dt>
                <dd>{formatDate(sub?.cancelAt ? null : sub?.currentPeriodEnd)}</dd>
                {sub?.cancelAt ? (
                  <>
                    <dt>Ends on</dt>
                    <dd>{formatDate(sub.cancelAt)}</dd>
                  </>
                ) : null}
                <dt>Organization</dt>
                <dd>{org.name}</dd>
              </dl>
              {manageable ? (
                <form method="post" action="/lumen/billing" style={{ marginTop: 'var(--base)' }}>
                  <input type="hidden" name="orgId" value={org.id} />
                  <input type="hidden" name="action" value="portal" />
                  <button type="submit" className="btn btn--style-secondary btn--size-medium" data-testid="manage-plan">
                    Manage payment and invoices
                  </button>
                </form>
              ) : null}
            </section>

            <h2 style={section}>Plans</h2>
            {plans?.ok === false ? (
              <LoadError code={plans.code} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: 'var(--base)', maxWidth: 960 }}>
                {orderedPlans(plans?.ok === true ? plans.value : []).map((p) => (
                  <section key={p.code} style={{ ...card, marginBottom: 0 }} data-testid={`plan-${p.code}`}>
                    <h3 style={{ marginTop: 0 }}>{p.name}</h3>
                    <p style={{ fontWeight: 600 }}>{priceLabel(p)}</p>
                    <ul style={{ paddingLeft: '1.1rem', color: 'var(--theme-elevation-600)' }}>
                      {planFeatureLines(p.code).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <PlanButton plan={p} orgId={org.id} action={planChangeAction({ target: p, currentCode, manageable })} />
                  </section>
                ))}
              </div>
            )}

            <h2 style={section}>What your plan includes</h2>
            {entitlements.length === 0 ? (
              <p>Nothing recorded yet.</p>
            ) : (
              <table style={{ width: '100%', maxWidth: 960, borderCollapse: 'collapse' }} data-testid="entitlements">
                <thead>
                  <tr>
                    <th style={cell}>Entitlement</th>
                    <th style={cell}>Included</th>
                    <th style={cell}>Limit</th>
                  </tr>
                </thead>
                <tbody>
                  {entitlements.map((e) => (
                    <tr key={e.id}>
                      <td style={cell}>
                        <code>{e.entitlementKey}</code>
                      </td>
                      <td style={cell}>{e.enabled ? 'yes' : 'no'}</td>
                      <td style={cell}>{e.valueType === 'boolean' ? '—' : e.limitValue === null ? 'unlimited' : e.limitValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2 style={section}>Invoices</h2>
            {invoices?.ok === false ? (
              <LoadError code={invoices.code} />
            ) : (invoices?.ok === true ? invoices.value : []).length === 0 ? (
              <p data-testid="no-invoices">No invoices yet. They appear here after the first charge.</p>
            ) : (
              <table style={{ width: '100%', maxWidth: 960, borderCollapse: 'collapse' }} data-testid="invoices">
                <thead>
                  <tr>
                    <th style={cell}>Number</th>
                    <th style={cell}>Status</th>
                    <th style={cell}>Amount</th>
                    <th style={cell}>Issued</th>
                    <th style={cell}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoices?.ok === true ? invoices.value : []).map((i) => (
                    <tr key={i.id}>
                      <td style={cell}>
                        <code>{i.number ?? i.id.slice(0, 12)}</code>
                      </td>
                      <td style={cell}>{i.status}</td>
                      <td style={cell}>{formatMoney(i.amountDueCents, i.currency)}</td>
                      <td style={cell}>{formatDate(i.issuedAt)}</td>
                      <td style={cell}>
                        {i.hostedUrl ? (
                          <a href={i.hostedUrl} target="_blank" rel="noopener noreferrer">
                            View
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </AccountTemplate>
  )
}

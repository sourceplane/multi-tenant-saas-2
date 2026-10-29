import type { AdminViewServerProps } from 'payload'

import { getPreferences, listOrganizations, pickOrganization } from '@/lib/lumen/account-api'
import { effectiveCategories, PREFERENCE_CATEGORIES } from '@/lib/lumen/models/preferences'
import { lumenTransport } from '@/lib/lumen/transport'

import { AccountHeading, AccountTemplate, card, LoadError, param, requireStaff, StatusLine } from './AccountPage'

// Notifications (design §4): which kinds of email Lumen sends this account
// for an organization. A category is on unless it was turned off.
export async function NotificationsView(props: AdminViewServerProps) {
  const token = requireStaff(props, '/admin/organization/notifications')
  const transport = await lumenTransport()
  const orgs = await listOrganizations(transport, token)
  const org = orgs.ok === true ? pickOrganization(orgs.value, param(props, 'org')) : null
  const prefs = org ? await getPreferences(transport, token, org.id) : null
  const effective = effectiveCategories(prefs?.ok === true ? prefs.value : [])
  return (
    <AccountTemplate props={props}>
      <div data-testid="lumen-notifications">
        <AccountHeading
          title="Notifications"
          description="Which email Lumen sends you for this organization. Critical security email may still arrive."
        />
        <StatusLine props={props} />
        {orgs.ok === false ? (
          <LoadError code={orgs.code} />
        ) : !org ? (
          <p>Your account does not belong to an organization yet.</p>
        ) : prefs && prefs.ok === false ? (
          <LoadError code={prefs.code} />
        ) : (
          <form method="post" action="/lumen/notifications" style={card}>
            <input type="hidden" name="orgId" value={org.id} />
            <p style={{ marginTop: 0 }}>
              For <strong>{org.name}</strong>
            </p>
            {PREFERENCE_CATEGORIES.map(({ key, label, description }) => {
              const on = effective[key]
              return (
                <label key={key} style={{ display: 'flex', gap: 'calc(var(--base) / 2)', marginBottom: 'var(--base)', alignItems: 'flex-start' }}>
                  <input type="checkbox" name={key} defaultChecked={on} data-testid={`category-${key}`} style={{ marginTop: 4 }} />
                  <span>
                    <strong>{label}</strong>
                    <br />
                    <span style={{ color: 'var(--theme-elevation-500)' }}>{description}</span>
                  </span>
                </label>
              )
            })}
            <button type="submit" className="btn btn--style-primary btn--size-medium">
              Save
            </button>
          </form>
        )}
      </div>
    </AccountTemplate>
  )
}

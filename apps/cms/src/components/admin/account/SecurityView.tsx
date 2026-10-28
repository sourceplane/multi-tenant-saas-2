import type { AdminViewServerProps } from 'payload'

import { listSecurityEvents } from '@/lib/lumen/account-api'
import { toSecurityRow } from '@/lib/lumen/models/security-events'
import { lumenTransport } from '@/lib/lumen/transport'

import { AccountHeading, AccountTemplate, LoadError, param, requireStaff } from './AccountPage'

const cell = { padding: 'calc(var(--base) / 2)', borderBottom: '1px solid var(--theme-elevation-100)', textAlign: 'left' as const }

// Security activity (design §4): the person's own sign-in and session
// events, newest first, a page at a time. The cursor is api-edge's.
export async function SecurityView(props: AdminViewServerProps) {
  const token = requireStaff(props, '/admin/account/security')
  const cursor = param(props, 'cursor') ?? null
  const result = await listSecurityEvents(await lumenTransport(), token, cursor)
  return (
    <AccountTemplate props={props}>
      <div data-testid="lumen-security">
        <AccountHeading
          title="Security activity"
          description="Sign-ins, codes and sessions on your Lumen account. Codes and tokens are never shown."
        />
        {result.ok === false ? (
          <LoadError code={result.code} />
        ) : result.value.events.length === 0 ? (
          <p>No security events yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="security-events">
            <thead>
              <tr>
                <th style={cell}>When</th>
                <th style={cell}>Event</th>
                <th style={cell}>Outcome</th>
                <th style={cell}>IP</th>
                <th style={cell}>Browser</th>
              </tr>
            </thead>
            <tbody>
              {result.value.events.map(toSecurityRow).map((r) => (
                <tr key={r.id}>
                  <td style={cell}>
                    <time dateTime={r.occurredAtLabel}>{r.occurredAtLabel}</time>
                  </td>
                  <td style={cell}>
                    <code>{r.eventType}</code>
                  </td>
                  <td style={cell}>{r.badge.label}</td>
                  <td style={cell}>{r.ip}</td>
                  <td style={{ ...cell, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.userAgent}>
                    {r.userAgent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <nav style={{ display: 'flex', gap: 'var(--base)', marginTop: 'var(--base)' }}>
          {cursor ? <a href="/admin/account/security">Newest events</a> : null}
          {result.ok === true && result.value.nextCursor ? (
            <a href={`/admin/account/security?cursor=${encodeURIComponent(result.value.nextCursor)}`} data-testid="older-events">
              Older events
            </a>
          ) : null}
        </nav>
      </div>
    </AccountTemplate>
  )
}

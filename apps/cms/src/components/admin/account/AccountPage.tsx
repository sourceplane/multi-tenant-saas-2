import { DefaultTemplate } from '@payloadcms/next/templates'
import { Banner, Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import type React from 'react'

import { staffRoleOf } from '@/lib/access'
import { LUMEN_SESSION_COOKIE, readCookie } from '@/lib/lumen/cookies'
import { statusMessage } from '@/lib/lumen/status'

// What every account page shares (lumen-payload-console design §4). Payload
// leaves custom views to check access themselves and to bring their own
// template, so: signed out → the sign-in, pending → the pending page, staff
// → the page inside the admin's own template.

/** The session token of a staff member viewing `path`, or a redirect away. */
export function requireStaff({ initPageResult }: AdminViewServerProps, path: string): string {
  const { user, headers } = initPageResult.req
  const token = readCookie(headers, LUMEN_SESSION_COOKIE)
  if (!user || !token) redirect(`/admin/login?redirect=${encodeURIComponent(path)}`)
  if (!staffRoleOf(user)) redirect('/admin/unauthorized')
  return token
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export function param(props: AdminViewServerProps, name: string): string | undefined {
  return first(props.searchParams?.[name] as string | string[] | undefined)
}

/** The line a form's redirect asked for: saved, or what went wrong. */
export function StatusLine({ props }: { props: AdminViewServerProps }) {
  const status = statusMessage({ saved: param(props, 'saved'), error: param(props, 'error'), notice: param(props, 'notice') })
  if (!status) return null
  return (
    <div data-testid="status-line" data-status={status.kind}>
      <Banner type={status.kind === 'error' ? 'error' : status.kind === 'notice' ? 'info' : 'success'}>{status.text}</Banner>
    </div>
  )
}

/** A page that could not load its data from Lumen. */
export function LoadError({ code }: { code: string }) {
  return (
    <div data-testid="load-error">
      <Banner type="error">{statusMessage({ error: code })?.text}</Banner>
    </div>
  )
}

export function AccountHeading({ title, description }: { title: string; description: string }) {
  return (
    <header style={{ marginBottom: 'calc(var(--base) * 1.5)' }}>
      <h1 style={{ marginBottom: 'calc(var(--base) / 2)' }}>{title}</h1>
      <p style={{ color: 'var(--theme-elevation-500)', margin: 0 }}>{description}</p>
    </header>
  )
}

/** A custom admin view inside Payload's default template (nav, header). */
export function AccountTemplate({ props, children }: { props: AdminViewServerProps; children: React.ReactNode }) {
  const { initPageResult, params, searchParams } = props
  const { req } = initPageResult
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      req={req}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={{
        collections: initPageResult.visibleEntities?.collections,
        globals: initPageResult.visibleEntities?.globals,
      }}
    >
      <Gutter>{children}</Gutter>
    </DefaultTemplate>
  )
}

export const card: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m)',
  padding: 'calc(var(--base) * 1.25)',
  marginBottom: 'var(--base)',
  maxWidth: 720,
}

export const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: '10rem 1fr', gap: 'calc(var(--base) / 2)', margin: 0 }

'use client'

import { Link, NavGroup } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'

// The Account group in the admin's nav (design §4), styled as Payload's own
// links. The nav only renders for people who can use the admin.
const LINKS = [
  { href: '/admin/account', label: 'Profile' },
  { href: '/admin/account/security', label: 'Security activity' },
  { href: '/admin/organization', label: 'Organization' },
  { href: '/admin/organization/notifications', label: 'Notifications' },
  { href: '/admin/organization/billing', label: 'Billing & plan' },
]

export function AccountNav() {
  const pathname = usePathname()
  return (
    <NavGroup label="Account">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href
        const inner = (
          <>
            {active ? <div className="nav__link-indicator" /> : null}
            <span className="nav__link-label">{label}</span>
          </>
        )
        return active ? (
          <div key={href} className="nav__link" id={`nav-lumen-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
            {inner}
          </div>
        ) : (
          <Link key={href} className="nav__link" href={href} prefetch={false} id={`nav-lumen-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
            {inner}
          </Link>
        )
      })}
    </NavGroup>
  )
}

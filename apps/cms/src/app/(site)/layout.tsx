import type { ReactNode } from 'react'

// The root layout for the staff sign-in routes (/auth/lumen/*), which live
// outside the academy's (learn) group and Payload's (payload) group.
export const metadata = { title: 'Sign in — Multi Tenant Saas 2' }

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  )
}

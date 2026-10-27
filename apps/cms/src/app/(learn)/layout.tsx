import type { ReactNode } from 'react'

import { learnerSession } from '../../lms/session'
import { signOut } from './actions'
import './learn.css'

// Every page depends on who is signed in: nothing here is prerendered.
export const dynamic = 'force-dynamic'

export const metadata = { title: { default: 'Courses — Multi Tenant Saas 2', template: '%s — Multi Tenant Saas 2' } }

export default async function LearnLayout({ children }: { children: ReactNode }) {
  const { learner } = await learnerSession()
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="top">
          <div className="top-inner">
            <a className="brand" href="/">Multi Tenant Saas 2 · Academy</a>
            <nav className="nav" aria-label="Main">
              <a href="/">Courses</a>
              {learner ? (
                <>
                  <a href="/me">My learning</a>
                  <span className="who">{learner.name ?? learner.email}</span>
                  <form action={signOut}>
                    <button className="linklike" type="submit">Sign out</button>
                  </form>
                </>
              ) : (
                <>
                  <a href="/login">Sign in</a>
                  <a href="/register">Create account</a>
                </>
              )}
            </nav>
          </div>
        </header>
        <main id="main" className="wrap">{children}</main>
        <footer className="foot">
          <div className="wrap">Staff sign in at <a href="/admin">/admin</a>.</div>
        </footer>
      </body>
    </html>
  )
}

# multi-tenant-saas-2-console (LX) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| LX0 — the spec | Merged | sourceplane/multi-tenant-saas-2#18 |
| LX1 — staff sign-in | In review | — |
| LX2 — account and billing | Not started | — |
| LX3 — the front door | Not started | — |
| LX4 — the record | Not started | — |

## Departures from the design

- **LX1, the `(site)` layout.** lumen-payload's `(site)` group already had a
  root layout (its landing page); here the group is new, so LX1 adds a minimal
  one for the `/auth/lumen/*` pages.
- **LX1, both sessions in one browser.** Payload asks `users`' strategy first,
  so where a browser holds a staff and a learner session, the staff one wins
  and the academy sees no learner (`/api/lms/me` answers 401). The runbook
  says to check the academy as a learner in another browser profile.

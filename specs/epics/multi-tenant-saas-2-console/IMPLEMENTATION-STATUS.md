# multi-tenant-saas-2-console (LX) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| LX0 — the spec | Merged | sourceplane/multi-tenant-saas-2#18 |
| LX1 — staff sign-in | In review | — |
| LX2 — account and billing | In review | — |
| LX3 — the front door | In review | — |
| LX4 — the record | Not started | — |

## Departures from the design

- **LX1, the `(site)` layout.** lumen-payload's `(site)` group already had a
  root layout (its landing page); here the group is new, so LX1 adds a minimal
  one for the `/auth/lumen/*` pages.
- **LX1, both sessions in one browser.** Payload asks `users`' strategy first,
  so where a browser holds a staff and a learner session, the staff one wins
  and the academy sees no learner (`/api/lms/me` answers 401). The runbook
  says to check the academy as a learner in another browser profile.
- **LX3, the console's leftovers.** The LMS's console kept a few files of its
  own (its artifact pin, Next and OpenNext configs, the web manifest, its
  `src/lib` and an app-config test) whose content differed from
  lumen-payload's, so PX4's deletions did not apply to them; LX3 removes them
  too, leaving the console exactly the redirect Worker PX4 shipped.

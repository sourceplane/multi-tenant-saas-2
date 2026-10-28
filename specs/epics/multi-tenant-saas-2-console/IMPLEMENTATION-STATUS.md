# multi-tenant-saas-2-console (LX) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| LX0 — the spec | Shipped | sourceplane/multi-tenant-saas-2#18 |
| LX1 — staff sign-in | Shipped; live on stage and prod | sourceplane/multi-tenant-saas-2#19 |
| LX2 — account and billing | Shipped; live on stage and prod | sourceplane/multi-tenant-saas-2#20 |
| LX3 — the front door | Shipped; live on stage and prod | sourceplane/multi-tenant-saas-2#21 |
| LX4 — the record | Shipped | this change |

## Live verification (2026-10-28)

Each milestone was checked against the deployed Workers after its merge.
**Stage has no staff admin yet:** the first admin needs the owner's setup
token (`CMS_SETUP_TOKEN`, risk LX-E), so every staff account there is pending.
The admin's signed-in pages were therefore checked on the built CMS Worker in
workerd, against stage's real api-edge and identity-worker, and the deployed
stage CMS for everything a pending or signed-out visitor can reach.

- **LX1, stage and prod: 12/12.** `/health` ok; `/admin` shows the Lumen
  staff sign-in and no password field; staff password login and
  first-register answer 403; a learner's bad password still answers 401 (the
  learners' own sign-in is on); the academy's catalogue renders at `/`.
- **LX2, the built Worker against stage's api-edge: 23/23.** The first admin
  opens with a setup token; the nav's Account group; the display name saved
  and read back from Lumen and the `users` row; Security activity lists the
  sign-in; the organization; a notification category off and back on, read
  back from Lumen; another origin's post refused; signed-out and pending
  visitors kept out of every page and form. Billing & plan: 11/11 (a new
  account is on Free; paid plans offer checkout; what the plan includes; no
  invoices and no portal without a paid subscription; Upgrade comes back
  explaining that stage has no payment provider; the checkout return posts
  one reconcile; opening the return link alone writes nothing).
- **LX2, deployed stage: 14/14.** Signed out, every account page sends you to
  the sign-in and back after, and its forms do not post; a newcomer waits as
  pending and cannot open any of the five pages or post their forms; security
  activity answers 200 through api-edge and lists the sign-in (the
  identity-worker fix, which made it 503 for everyone before); 15 own-session
  reads in a row answer 200 (the `account` rate family).
- **LX3, stage and prod: 10/10 each.** The console URL's `/`, `/login`,
  `/account`, `/orgs/<slug>/settings/billing?checkout=complete`,
  `/orgs/<slug>/settings/notifications` and `/auth/callback?…` answer 308 to
  `/admin`, `/admin/login`, `/admin/account`,
  `/admin/organization/billing?checkout=complete`,
  `/admin/organization/notifications` and `/auth/lumen/callback?…` (query
  kept) on the same environment's CMS; following the console URL lands on the
  staff sign-in, titled *Login — Multi Tenant Saas 2*; the CMS root still
  renders the academy's catalogue. LX1's 12 checks were re-run after LX3 and
  still pass on both.
- **Prod, read-only:** `/health` ok, `/admin/login` renders the Lumen sign-in,
  staff password login answers 403, the catalogue renders. Prod's first admin
  waits for the owner.

**A note on the browser runs.** The sandbox's egress proxy percent-encodes
`(` and `)` in request paths, so Chromium's request for the admin's
`/_next/static/chunks/app/(payload)/…` chunk reached Workers Static Assets as
`%28payload%29` and looped on a 307. The runs fetched `/_next/static/**`
through Playwright's own network stack; ordinary browsers send the literal
path and get 200 (the same as recorded in sourceplane/lumen-payload's
console epic). It is a property of that sandbox, not of the deployment.

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
- **LX4, the dependency lists.** The overview pages of api-edge, the parked
  domain, contracts and the SDK still named the Next.js console among their
  dependents or dependencies; the record replaces it with the CMS, which is
  what each now serves or is used by, and drops it where the redirect Worker
  uses nothing.

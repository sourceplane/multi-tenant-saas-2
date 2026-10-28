# multi-tenant-saas-2-lms (LMS) — Implementation status

As-built ≠ intent. This file records what actually shipped, and every place
the code departed from `design.md`.

| Milestone | State | PR |
|---|---|---|
| LMS0 — the spec | ✅ Shipped | sourceplane/multi-tenant-saas-2#6 |
| LMS1 — the CMS layer | ✅ Shipped: Hyperdrive config and Payload secret, migration 200, `multi-tenant-saas-2-cms-stage` and `-prod` live | sourceplane/multi-tenant-saas-2#7 |
| LMS2 — the course model | ✅ Shipped: migrations 300 and 301 applied; *Demo Academy* and *Getting started* published | sourceplane/multi-tenant-saas-2#8 |
| LMS3 — learner records | ✅ Shipped: migration 310 applied; `/api/lms` live | sourceplane/multi-tenant-saas-2#9 |
| LMS4 — the learner app | ✅ Shipped: catalogue, course, lesson, quiz, certificate and account pages live | sourceplane/multi-tenant-saas-2#10 |
| LMS5 — the record | ✅ Shipped | sourceplane/multi-tenant-saas-2#11 |

## Live verification (2026-10-28)

**Stage** (`https://multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev`), with
throwaway `e2e-*@example.com` learners:

- **Through the API, 32 of 32 checks:**
  - `/health` ok with the database ok, and the catalogue renders
  - an anonymous visitor sees the published course but no lesson body or quiz question
  - a learner registers (a second registration with the same email is refused) and signs in
  - the learner can't reach staff accounts or complete a lesson before enrolling
  - a form-encoded write is refused (415)
  - enrolling works, and enrolling again is a no-op
  - after enrolling, lesson bodies and quiz prompts are visible, but never the answer key
  - three lessons, then a failing quiz scored on the server (67 %), then a passing one that completes the course
  - *My learning* shows 3 of 3 and the certificate
  - anyone can verify the certificate by serial (learner, course and academy, no email), and its page renders
  - a later passing attempt issues no second certificate, and a learner cannot mint one
  - a second learner sees none of the first's records, and anonymous visitors can't list records
- **In Chromium, 21 of 21 checks:**
  - catalogue, course page, register, enrol, the lesson body
  - a failed then a passed quiz, the certificate, *My learning* (completed, 3 of 3) and the course's certificate link
  - sign out, the public certificate, lessons needing a session, the 404 page, a bad sign-in
  - no horizontal scroll at phone width, and no page errors
- **The admin in Chromium** on stage and prod of both CMSs renders the
  create-first-user form, and submitting it is refused (403) while setup is
  closed.

**Prod** (`https://multi-tenant-saas-2-cms-prod.nexo-7be.workers.dev`), read-only:

- `/health` ok with the database ok, and the catalogue renders
- the course and register pages answer 200
- `/api/lms/me` answers 401 without a session
- an anonymous lesson redirects to sign-in
- anonymous first-user registration is refused (403)

A note for whoever verifies next from a sandboxed machine. This session's
egress proxy percent-encodes `(` and `)` in Chromium's request paths (an echo
server received `%28learn%29` where curl sent `(learn)`). Workers Static
Assets answers the encoded form with a 307 to the literal path, so Chromium
loops on Next's route-group chunks (`/_next/static/chunks/app/(learn)/…`,
`…/(payload)/…`). A browser on an ordinary network sends the literal path and
gets 200; the browser runs above fetched `/_next/static/**` over Node's HTTP
stack to step around the proxy.

## Departures from the design

- **Inherited from the CMS layer** (lumen-payload-cms's status file has the
  detail):
  - the wiring and the Payload secret are optional references
  - the first-user gate sits on the operation, not the page: `/admin/create-first-user` renders, and creating the first account is refused by every route until setup is opened
  - the CMS suite runs inside the CMS lane's build
- **The CMS layer landed in one pull request (#7)**, as LMS1 planned, and its
  first main run hit the cross-environment race recorded as **LMS-J**: the
  stage CMS lane ran before prod's Hyperdrive wiring was published. One re-run
  of the two failed lanes converged it.
- **Landing order.** LMS1–LMS5 were developed as a stack and landed one at a
  time after the baseline's bootstrap finished, each rebased onto `main` and
  re-verified by CI there. LMS3's first CI attempt lost its `db-migrate · stage`
  lane to an Orun Cloud backend timeout before any step ran; that run was
  cancelled and its two migration lanes re-run once, and both passed.
- **Workers Paid (LMS-I) was needed before anything here could land:** the
  baseline's own 04-workers phase stopped on Free's cron limit, and the owner
  upgraded the account.

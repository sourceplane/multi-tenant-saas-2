# multi-tenant-saas-2-lms — risks and open questions

## LMS-A — One pooled instance holds every tenant's learners (RISK, mitigated)

A bad access rule is a cross-tenant read. Mitigations: tenancy is a handful of
shared functions (`lib/lms-access.ts`), each tested in `tests/cms` for each
actor of design §2 and exercised live (instructors refused outside their
academies, no self-escalation of role or academies); lessons and quizzes take
their academy from their course on the server; learner records are only ever
written by the services. The shared-pool hazard of `payloadcms/payload#17335`
does not apply: the CMS layer opens a Postgres client per query or
transaction and lets Hyperdrive pool (`lumen-payload-cms` PC-A). Revisit if a
tenant needs isolation by contract: that is a database per tenant, which
Hyperdrive's 25-config limit makes a different architecture.

## LMS-B — Learner records in Payload, not a Lumen worker (RESOLVED)

The alternative was a `learning-worker` behind `api-edge` with its own
migrations. Rejected for v1: the learner app runs on the CMS host, and
`workers.dev` is a public suffix, so it cannot share Lumen's session; a
worker would need a token hand-off for every call. Payload collections on
Postgres give the same transactional guarantees with one auth system.

## LMS-C — Completion and certification are one transaction (RESOLVED)

Partial failure in `attempt → grade → complete → certify` would leave a
learner completed without a certificate, or certified without completing.
Decided: one Payload transaction per service call, plus database uniqueness on
enrolments, progress and certificates, so retries and races converge.

One race needed more than that: read committed lets two final requirements
finished at once each miss the other's write, and nobody completes the course.
Found by testing it (8 of 10 raced rounds uncertified); fixed by serializing
every service on the learner's enrolment row (design §3), after which 10 of 10
issue exactly one certificate. A learner left in that state by anything else
heals on their next lesson or passing attempt, which re-evaluates.

## LMS-D — Quiz answers never leave the server (RESOLVED)

`correct_index` is readable only by staff (field-level access); scoring runs in
the attempt service. The learner app receives prompts and options only.

## LMS-E — No learning standard is supported yet (ACCEPTED)

SCORM, xAPI/cmi5 and LTI each serve a different buyer. Choosing none keeps v1
small; the model leaves room (a lesson can later carry a package or a launch
URL). Revisit when the first buyer is chosen.

## LMS-F — Media is URLs until R2 (ACCEPTED)

Courses carry `cover_url` and lessons `video_url`. Uploads arrive with the
CMS layer's R2 milestone, gated on an `r2-data` token.

## LMS-G — Learner accounts are self-asserted (ACCEPTED for v1)

Anyone can register, with no email verification: the CMS has no email
adapter yet, and Payload's `verify` flow needs one. So the name on a
certificate is the learner's claim, and an email address is not proven to be
theirs. Payload's login lockout (10 attempts, 10 minutes) limits guessing.
Revisit with an email adapter (Payload's `verify: true`) and, if abuse
appears, Cloudflare rate limiting on `/api/learners`.

## LMS-H — One session per browser (ACCEPTED)

Staff and learners are separate collections but share Payload's
`payload-token` cookie, so signing in as one signs out the other in that
browser. Instructors testing as a learner use a second browser profile.

## LMS-I — Workers Paid is a prerequisite (RISK, owner action)

Inherited from the CMS layer (`lumen-payload-cms` PC-H): the Worker is 3.3 MiB
compressed in CI's dry-run deploy (Free allows 3 MiB) and needs more than
Workers Free's 10 ms of CPU. The
Cloudflare account this product shares with `lumen-payload` also hit Free's
5-cron limit during the fleet bootstrap.


## LMS-J — The first landing of a wiring source races across environments (FOUND, recovered)

The CMS's `wrangler.template.jsonc` names both environments' Hyperdrive ids, so
every CMS deploy's `wire-live` needs the wiring of stage **and** prod. But
`dependsOn` orders only within one environment: `cms.stage` waits for
`cloudflare-hyperdrive-cms.stage`, not for prod. This repository landed the
whole CMS layer in one pull request (#7), so on its first main run the stage
CMS lane resolved its secrets at 04:03:56, twelve seconds before the prod
Hyperdrive apply published its wiring; the prod wiring was empty (it is an
optional reference), `wire-live` stopped, and the prod CMS lane failed behind
it. One re-run of the two failed lanes converged it, and it cannot recur here:
both wirings now exist. A product built from this layer should land the
Hyperdrive component before the CMS, as lumen-payload did.

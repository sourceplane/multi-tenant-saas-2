# multi-tenant-saas-2-lms — implementation plan

Milestones land in order, one task per pull request, on `orun/LMS-<n>-<slug>`
branches with an `Orun-Task: LMS-<n>` trailer on every commit and the manifest
block in the body. CI runs every lane on these branches; a pull request merges
only on green, and a milestone is ✅ only when its "done when" list is true on
the live system.

## LMS0 — the spec

This doc set and `tasks/LMS-1.TaskContract.yaml`.

**Done when**
- the five documents are on `main`

## LMS1 — the CMS layer

Port `lumen-payload`'s PC1–PC3 as they shipped there: the
`cloudflare-hyperdrive-cms` component, migration `200_cms_payload_core`,
`apps/cms` and `tests/cms`, with every name, secret path and URL rebranded to
this repository and workspace. One pull request: the layer is already proven,
and its components declare the `dependsOn` that orders a single convergence.

**Done when**
- every lane of the PR is green
- after the merge, on stage and prod: `/health` answers ok, `/admin` answers
  200, and an anonymous first-register answers 403

## LMS2 — the course model

Collections `tenants`, `courses`, `lessons`, `quizzes`; the `instructor` role
and tenant scoping on `users`; field-level access hiding `correct_index`.
Migrations `300_lms_course_model` (generated, as in the CMS) and
`301_lms_sample_academy` (the seed of design §5).

**Done when**
- both migrations apply on stage and prod
- `GET /api/courses?where[slug][equals]=getting-started` returns the sample
  course anonymously, and `GET /api/quizzes/<id>` returns no `correct_index`

## LMS3 — learner records

Collections `learners` (auth), `enrolments`, `lesson_progress`,
`quiz_attempts`, `certificates`, with the unique constraints of design §1;
`apps/cms/src/lms/services.ts` and the `/api/lms/*` endpoints of §3; unit
tests for scoring and completion in `tests/cms`. Migration
`310_lms_learner_records`.

**Done when**
- the migration applies on stage and prod
- on stage, through the API alone: a learner registers, enrols in the sample
  course, completes its three lessons, passes its quiz, and
  `GET /api/lms/certificates/<serial>` verifies the certificate that was issued
- a failing quiz attempt does not complete the course; a second enrol is a no-op

## LMS4 — the learner app

The `(learn)` routes of design §4, styled, accessible (semantic HTML, labelled
controls, focus states), and the smoke check extended to assert the catalogue
renders.

**Done when**
- on stage and prod, `/` lists *Getting started*
- in a browser on stage, the whole path works: register → enrol → three
  lessons → quiz → certificate → `/certificates/<serial>`

## LMS5 — the record

`ai/context/operations.md` (running the academy: opening the admin, adding an
instructor, publishing a course), component docs, `AGENTS.md`, and
`IMPLEMENTATION-STATUS.md` marked shipped with every departure named.

**Done when**
- an owner can open the admin and publish a course from the docs alone
- the status file is complete

## Sequencing note

LMS1 waits for `lumen-payload` PC3 to be live, because it ports what shipped
there rather than what was planned. LMS2 before LMS3 because records point at
courses; LMS3 before LMS4 because the app calls the services. Each migration
lands before or with the code that reads it, and `apps/cms` depends on
`db-migrate`, so a convergence never starts the app ahead of its schema.

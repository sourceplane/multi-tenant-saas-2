# Epic: multi-tenant-saas-2-lms (LMS)

**`multi-tenant-saas-2` is a Lumen instance with nothing to teach. This epic
makes it a multi-tenant learning platform: academies publish courses, learners
enrol, work through lessons and quizzes, and earn certificates anyone can
verify. It is built on the `lumen-payload` baseline's CMS layer, ported here
unchanged, and the one design idea that keeps it small is that the vertical
fixes the content model: every tenant shares one set of collections, so
Payload's code-defined schema is the product rather than a limitation, and
tenancy is a field and an access rule instead of a deployment per customer.**

It is for a builder who needs a working LMS they own — an agency standing one
up for a client, or a team adding courses to their product — without writing
the content plane, the learner records or the learner-facing app. When it
ships, the deployed product answers on stage and prod with a sample academy and
course, a learner can register, enrol, finish the course and print a
certificate, and an instructor can author the next course in `/admin`.

## Status

| Field | Value |
|-------|-------|
| Status | Shipped (LMS0–LMS6) |
| Cluster | **LMS** (LMS0–LMS5) |
| Owner(s) | `apps/cms` (content, learner records, learner app) · `infra/terraform/cloudflare-hyperdrive-cms` · `packages/db` (schema, as migrations) |
| Builds on | `lumen baseline-v32` for the fleet, and `sourceplane/lumen-payload`'s PC1–PC3 for the CMS layer |
| Changes | Adds the CMS layer (three components, one migration) and the learning domain on top of it. No existing worker changes. |
| Decisions locked | (1) One pooled Payload instance; tenancy by field and access rule. (2) Learner records are Payload collections on Postgres, so enrolment, completion and certification are **transactional**. (3) Learners sign in to the learner app itself, not through Lumen identity. (4) A course is complete when every lesson is done and every quiz is passed; completion issues the certificate in the same transaction. (5) Quizzes are scored on the server and correct answers never reach a learner. (6) Every service that changes progress serializes on the learner's enrolment row. |
| Gate | LMS1 is the ported CMS. LMS2 is invisible to learners. LMS4 is the first learner-facing change. |
| Shipped as | sourceplane/multi-tenant-saas-2#6 (spec), #7 (the CMS layer), #8 (course model), #9 (learner records), #10 (learner app), #11 (the record), #24 and #25 (media on R2) and its record |

## Read order

1. `design.md` — the model, the transactional flows, the learner app, tenancy, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| LMS0 — the spec | this doc set | merged to `main` |
| LMS1 — the CMS layer | `lumen-payload`'s CMS database path, schema and app, rebranded | `/health` and `/admin` answer on stage and prod |
| LMS2 — the course model | tenants, courses, lessons, quizzes; instructor role and tenant scoping; a seeded sample academy | the sample course is readable from the REST API on stage and prod |
| LMS3 — learner records | learners, enrolments, lesson progress, quiz attempts, certificates; the transactional services and their endpoints | a learner can enrol, complete and be certified through the API on stage |
| LMS4 — the learner app | catalogue, course page, lesson player, quizzes, my learning, public certificates | the catalogue renders the sample course on stage and prod, and the full path works in a browser |
| LMS5 — the record | operations guide, docs, status | an owner can run the academy from the docs alone |
| LMS6 — media on R2 (added after LMS5) | the CMS's media bucket; uploads scoped to the site or an academy; its record | uploads work on stage and prod, and an instructor's reach ends at their academies |

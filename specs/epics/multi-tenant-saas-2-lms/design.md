# multi-tenant-saas-2-lms — design

## 0. Shape

```
 learner ──► apps/cms  (one Worker, one Next.js app)
               /                 learner app   (catalogue, player, quizzes, certificates)
               /admin            Payload admin (staff: admin, editor, instructor)
               /api/*            Payload REST + GraphQL, and /api/lms/* services
                     │
                     │ Hyperdrive-CMS (cache disabled)
                     ▼
               Supabase Postgres ── schema cms: content, learner records, sessions
```

The Lumen fleet is unchanged and remains the operator's control plane. This is
the `lumen-payload` CMS layer (its design §0–§5 apply verbatim) plus a learning
domain inside the same Payload instance — the pooled, fixed-model shape, which
is right here because the vertical owns the content model.

## 1. The model

All collections live in schema `cms`, with UUID ids. **T** marks a
tenant-owned collection: it carries `tenant` (required, indexed) and every
access rule filters on it.

```
tenants          T-root   name, slug (unique), description, enrolment: open | closed
users            staff    email, role: admin | editor | instructor, tenants[] (instructor scope)
courses          T        title, slug (unique per tenant), summary, level, coverUrl,
                          status (draft | published, via versions), instructor → users
lessons          T        course → courses, order, title, content (Lexical), video_url, minutes
quizzes          T        course → courses, title, passing_score (0–100),
                          questions[] { prompt, options[] { label }, correct_index }
learners         auth     email, name — the learner app's accounts
enrolments       T        learner → learners, course → courses, status: active | completed,
                          enrolled_at, completed_at          UNIQUE (learner, course)
lesson_progress  T        learner, course, lesson, completed_at UNIQUE (learner, lesson)
quiz_attempts    T        learner, quiz, course, score, passed, answers[], submitted_at
certificates     T        learner, course, serial (unique, public), issued_at
                                                             UNIQUE (learner, course)
```

The uniqueness constraints are database constraints, not application checks:
a double-click, a retry or two isolates racing cannot create a second
enrolment, a second progress row or a second certificate.

`editor` stays from the CMS layer for the site's pages and posts; it has no
say over courses. Field names are Payload's (camelCase); columns are
snake_case. Enrolments also carry `lastActivityAt`, which every service
touches first (§3).

## 2. Access

| Actor | Can |
|---|---|
| anonymous | read published courses, their lessons' titles and the quizzes' titles of tenants; read a certificate by serial |
| learner | everything anonymous can; read lesson content and quiz prompts and options of courses they are enrolled in; read **their own** enrolments, progress, attempts, certificates; call the `/api/lms/*` services |
| instructor | create and edit courses, lessons, quizzes in **their tenants** (the server checks the row's academy, which lessons and quizzes take from their course); read the learner records there |
| editor | the site's pages, posts and categories only |
| admin | everything |

`quizzes.questions[].correct_index` has field-level read access for staff
only, so neither REST, GraphQL nor the learner app can hand an answer key to a
learner. Learners never write enrolments, progress, attempts or certificates
directly: create and update are closed to them and open only to the services.

## 3. The transactional services

Each is one function in `apps/cms/src/lms/services.ts`, run inside one
Payload transaction (`payload.db.beginTransaction()`, every operation passed
`req: { transactionID }`, commit or roll back), and exposed both as a server
action for the learner app and as a REST endpoint. Writes take JSON only (a
cross-site form cannot send it without a preflight); learner cookies are
SameSite=Lax.

**One learner and course at a time.** Under read committed, two final
requirements finished at the same moment (the last lesson and the quiz) can
each check completion before the other commits, both see the course
unfinished, and the learner is never certified. So every service that changes
progress first updates the learner's enrolment row (`lastActivityAt`) inside
its transaction: the row lock makes concurrent services for one learner and
course run in turn, and the later one sees the earlier one's write. Measured
locally: without the lock, 8 of 10 raced rounds left a learner with
everything done and no certificate; with it, 10 of 10 issued exactly one.

| Service | Endpoint | In one transaction |
|---|---|---|
| enrol | `POST /api/lms/enrol {courseId}` | course is published and its tenant open → insert enrolment (idempotent on the unique key) |
| complete lesson | `POST /api/lms/lessons/{id}/complete` | learner enrolled → upsert progress → **evaluate completion** |
| submit quiz | `POST /api/lms/quizzes/{id}/attempt {answers}` | learner enrolled → score on the server → insert attempt → **evaluate completion** |
| my learning | `GET /api/lms/me` | read-only: the learner's courses, progress, certificates |
| verify | `GET /api/lms/certificates/{serial}` | read-only and public: learner name, course, academy, date; never the email |

**Evaluate completion** — every lesson of the course has progress for this
learner and every quiz of the course has a passing attempt → set the
enrolment `completed` and insert the certificate with a fresh serial. Both
writes are in the same transaction as the write that triggered them: a learner
is never `completed` without a certificate, or certified without being
`completed`.

This is the reason the vertical runs on Postgres and not D1: D1 has no
interactive transactions, and Payload's transaction model is interactive by
construction.

## 4. The learner app

Server-rendered routes in a `(learn)` group of the same Next.js app, reading
through Payload's Local API with `overrideAccess: false` and the learner from
the request's cookie, so the access rules of §2 are the app's rules too.

| Route | What it shows |
|---|---|
| `/` | the catalogue: published courses, by academy |
| `/academies/[academy]` | one academy's courses |
| `/courses/[academy]/[course]` | outline, lessons, quizzes; Enrol / Continue |
| `/learn/[academy]/[course]/[lesson]` | the lesson, its video, Mark complete, next lesson |
| `/learn/[academy]/[course]/quiz/[quiz]` | the quiz; the result after submitting |
| `/me` | my courses with progress, and my certificates |
| `/certificates/[serial]` | the certificate, printable, verifiable by anyone |
| `/login`, `/register` | learner accounts (Payload's `learners` auth) |

## 5. The sample academy

Migration `301_lms_sample_academy` seeds one tenant, *Demo Academy*, and one
published course with three lessons and one quiz, with fixed UUIDs. The
product is live on content from its first deploy. The seed is ordinary data:
an admin can edit or delete it, so the deploy's smoke check asserts that the
catalogue renders (a page marker), not that this course is in it.

## 6. Out of scope

- **SCORM, xAPI/cmi5 and LTI.** Each is a project; which one depends on the
  buyer (corporate compliance, analytics, or education). Not chosen yet.
- **Payments.** Enrolment is free. A paid course is a Stripe checkout that
  calls the enrol service on success — a later epic.
- **Media uploads** were out of scope here, waiting on `lumen-payload` PC4.
  They shipped later as LMS6 (`IMPLEMENTATION-STATUS.md`).
- **Lumen identity and orgs for learners.** `workers.dev` is a public suffix,
  so the console's session cannot reach the CMS host. A tenant may record its
  Lumen org (`tenants.lumenOrgId`, hidden from learners) for the operator's billing, but nothing
  enforces it yet.
- **Timed assessments.** A Durable Object per attempt; later.

# cms

Payload CMS on Cloudflare Workers: the admin panel at `/admin`, the REST API
at `/api/<collection>` and GraphQL at `/api/graphql`, over Postgres schema
`cms`, deployed beside the fleet as `multi-tenant-saas-2-cms-<env>`.

| | stage | prod |
|---|---|---|
| URL | https://multi-tenant-saas-2-cms-stage.nexo-7be.workers.dev | https://multi-tenant-saas-2-cms-prod.nexo-7be.workers.dev |

## What it holds

- **users**: staff accounts (`admin`, `editor`). The first account is created
  through the setup gate and is an admin; admins create the rest.
- **pages** and **posts**: drafts, versions (25 per document), a Lexical
  rich-text body and a unique slug. Posts have an excerpt and a category.
- **categories**: name and slug.

Published pages, posts and categories are readable by anyone through the API.
Drafts, accounts and everything else need a staff session.

### Learning (multi-tenant-saas-2-lms)

- **tenants** (academies): name, slug, description, open or closed enrolment.
  Admins create them and assign instructors.
- **courses**: per academy, with drafts and versions; the slug is unique within
  its academy.
- **lessons** and **quizzes**: per course, and in their course's academy (set
  by the server, never by the request). A quiz has questions with options and
  an answer key.
- **users** gain the `instructor` role and `tenants`, the academies they manage.

Anyone can read published courses and their lessons' and quizzes' titles.
Lesson bodies, videos, quiz questions and answer keys are readable only by
admins and the academy's own instructors. Instructors write only inside their
academies; only admins delete courses or manage academies and accounts. The
sample academy (migration 301) ships one published course, *Getting started*.

**Learners** are their own accounts (`learners`, separate from staff: a learner
can never reach `/admin`). Their records (`enrolments`, `lesson-progress`,
`quiz-attempts`, `certificates`) are written only by the services below, each
in one transaction; learners, instructors of the academy and admins can read
them. Enrolled learners can read lesson bodies and quiz questions, never the
answer key.

| Service | What it does, in one transaction |
|---|---|
| `POST /api/lms/enrol {courseId}` | enrols in a published course of an open academy; a repeat returns the same enrolment |
| `POST /api/lms/lessons/<id>/complete` | records the lesson (once), then completes the course if everything is done |
| `POST /api/lms/quizzes/<id>/attempt {answers}` | scores on the server, records the attempt, then completes the course if everything is done |
| `GET /api/lms/me` | the learner's courses, progress and certificates |
| `GET /api/lms/certificates/<serial>` | public: who, which course, which academy, when |

Completing a course sets the enrolment `completed` and issues exactly one
certificate in the same transaction as the write that finished it.

### The learner app

Server-rendered pages in the same Worker, reading through Payload with the
visitor's own access rules, so a page shows exactly what the API would give
the same person.

| Route | Page |
|---|---|
| `/` | the catalogue, by academy |
| `/academies/<academy>` | one academy's courses |
| `/courses/<academy>/<course>` | outline, progress, Enrol / Continue |
| `/learn/<academy>/<course>/<lesson>` | the lesson (enrolled learners), Mark complete |
| `/learn/<academy>/<course>/quiz/<quiz>` | the quiz and its result |
| `/me` | my courses, progress and certificates |
| `/certificates/<serial>` | the certificate: public, printable |
| `/login`, `/register` | learner accounts |

Staff and learners share Payload's session cookie, so one browser holds one
session at a time.

## Depends on

- **cloudflare-hyperdrive-cms**: its database path (cache disabled) and its
  generated Payload secret.
- **db-migrate**: applies schema `cms` (migration `200_cms_payload_core`)
  before the CMS deploys.

Nothing in the fleet calls the CMS, and the CMS calls nothing in the fleet.

## Verified by

- **cms-tests** on every pull request that touches it.
- The deploy's smoke check on stage and prod: `/health` reports the database
  `ok`, and `/admin` answers 200.

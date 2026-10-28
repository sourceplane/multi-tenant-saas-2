import { APIError, createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { isCourseComplete, newSerial, scoreQuiz, SERIAL_PATTERN } from './rules'

// The learning domain's writes (design §3). Learners never write their records
// through the collections' APIs: every change goes through one of these, and
// each runs in ONE Payload transaction, so a learner is never `completed`
// without a certificate, or certified without being `completed`.
//
// Every service that changes an enrolment's progress first touches that
// enrolment row (lastActivityAt) inside its transaction. The row lock makes
// concurrent changes for the same learner and course run one after another,
// so two lessons completed at the same moment cannot each miss the other's
// progress and leave the course uncertified.

type Id = string
type Rel = Id | { id: Id } | null | undefined
const idOf = (rel: Rel): Id | undefined => (!rel ? undefined : typeof rel === 'string' ? rel : rel.id)

export class LmsError extends APIError {
  constructor(message: string, status: number) {
    super(message, status, undefined, true)
  }
}

const now = () => new Date().toISOString()

/**
 * Runs `fn` in one transaction. Payload rolls the transaction back itself when
 * an operation inside it fails (and drops it from `req`), so a failure here
 * never commits; whatever is left open is rolled back.
 */
async function inTransaction<T>(payload: Payload, fn: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const req = await createLocalReq({}, payload)
  const id = await payload.db.beginTransaction()
  if (id !== null) req.transactionID = id
  try {
    const result = await fn(req)
    if (req.transactionID) await payload.db.commitTransaction(req.transactionID as string | number)
    return result
  } catch (err) {
    if (req.transactionID) await payload.db.rollbackTransaction(req.transactionID as string | number).catch((): void => undefined)
    throw err
  }
}

type Course = { id: Id; tenant: Rel; _status?: string | null; title?: string | null }
type Enrolment = { id: Id; status: 'active' | 'completed'; course: Rel; learner: Rel; tenant: Rel }

async function publishedCourse(payload: Payload, courseId: Id | undefined, req?: PayloadRequest): Promise<Course> {
  const course = courseId
    ? ((await payload.findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true, disableErrors: true, ...(req ? { req } : {}) })) as Course | null)
    : null
  if (!course || course._status !== 'published') throw new LmsError('Course not found.', 404)
  return course
}

async function findEnrolment(payload: Payload, learner: Id, course: Id, req?: PayloadRequest): Promise<Enrolment | undefined> {
  const { docs } = await payload.find({
    collection: 'enrolments',
    where: { and: [{ learner: { equals: learner } }, { course: { equals: course } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
  return docs[0] as Enrolment | undefined
}

async function lockedEnrolment(req: PayloadRequest, learner: Id, course: Id): Promise<Enrolment> {
  const enrolment = await findEnrolment(req.payload, learner, course, req)
  if (!enrolment) throw new LmsError('Enrol in the course first.', 403)
  // The lock (see the header): an UPDATE holds the row until commit.
  await req.payload.update({ collection: 'enrolments', id: enrolment.id, data: { lastActivityAt: now() }, depth: 0, overrideAccess: true, req })
  // Re-read after the lock: a transaction that held it before us may have
  // completed the enrolment meanwhile.
  return (await findEnrolment(req.payload, learner, course, req)) ?? enrolment
}

export type Completion = { completed: boolean; certificate?: { serial: string } }

async function certificateFor(req: PayloadRequest, learner: Id, course: Id) {
  const { docs } = await req.payload.find({
    collection: 'certificates',
    where: { and: [{ learner: { equals: learner } }, { course: { equals: course } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  })
  return docs[0] as { serial: string } | undefined
}

/** Completes the enrolment and issues the certificate if every requirement is met. */
async function evaluateCompletion(req: PayloadRequest, learner: Id, course: Course, enrolment: Enrolment): Promise<Completion> {
  if (enrolment.status === 'completed') {
    const cert = await certificateFor(req, learner, course.id)
    return { completed: true, ...(cert ? { certificate: { serial: cert.serial } } : {}) }
  }
  const all = { depth: 0, pagination: false, overrideAccess: true, req } as const
  const byCourse = { course: { equals: course.id } }
  const mine = { and: [{ learner: { equals: learner } }, byCourse] }
  const [lessons, quizzes, progress, passing] = await Promise.all([
    req.payload.find({ collection: 'lessons', where: byCourse, ...all }),
    req.payload.find({ collection: 'quizzes', where: byCourse, ...all }),
    req.payload.find({ collection: 'lesson-progress', where: mine, ...all }),
    req.payload.find({ collection: 'quiz-attempts', where: { and: [...mine.and, { passed: { equals: true } }] }, ...all }),
  ])
  const complete = isCourseComplete({
    lessonIds: lessons.docs.map((d) => d.id),
    quizIds: quizzes.docs.map((d) => d.id),
    completedLessonIds: progress.docs.map((d) => idOf(d.lesson as Rel)).filter((x): x is Id => Boolean(x)),
    passedQuizIds: passing.docs.map((d) => idOf(d.quiz as Rel)).filter((x): x is Id => Boolean(x)),
  })
  if (!complete) return { completed: false }
  const at = now()
  await req.payload.update({ collection: 'enrolments', id: enrolment.id, data: { status: 'completed', completedAt: at }, depth: 0, overrideAccess: true, req })
  const cert = await req.payload.create({
    collection: 'certificates',
    data: { tenant: idOf(course.tenant)!, learner, course: course.id, serial: newSerial(), issuedAt: at },
    depth: 0,
    overrideAccess: true,
    req,
  })
  return { completed: true, certificate: { serial: cert.serial } }
}

// --- the services -------------------------------------------------------------

export type EnrolResult = { enrolment: { id: Id; status: string }; created: boolean }

/** Enrol in a published course of an open academy. Idempotent: a second call returns the first enrolment. */
export async function enrol(payload: Payload, learner: Id, courseId: Id): Promise<EnrolResult> {
  const existing = await findEnrolment(payload, learner, courseId)
  if (existing) return { enrolment: { id: existing.id, status: existing.status }, created: false }
  try {
    return await inTransaction(payload, async (req) => {
      const course = await publishedCourse(payload, courseId, req)
      const tenant = (await payload.findByID({ collection: 'tenants', id: idOf(course.tenant)!, depth: 0, overrideAccess: true, req })) as {
        id: Id
        enrolment?: string
      }
      if (tenant.enrolment === 'closed') throw new LmsError('This academy is not taking new enrolments.', 403)
      const at = now()
      const doc = await payload.create({
        collection: 'enrolments',
        data: { tenant: tenant.id, learner, course: course.id, status: 'active', enrolledAt: at, lastActivityAt: at },
        depth: 0,
        overrideAccess: true,
        req,
      })
      return { enrolment: { id: doc.id, status: doc.status }, created: true }
    })
  } catch (err) {
    if (err instanceof LmsError) throw err
    // Two enrolments racing: the database's unique (learner, course) refused
    // the second. Answer with the one that won.
    const winner = await findEnrolment(payload, learner, courseId)
    if (winner) return { enrolment: { id: winner.id, status: winner.status }, created: false }
    throw err
  }
}

export type LessonResult = Completion & { lesson: Id }

/** Mark a lesson complete (idempotent), then evaluate the course. */
export async function completeLesson(payload: Payload, learner: Id, lessonId: Id): Promise<LessonResult> {
  return inTransaction(payload, async (req) => {
    const lesson = (await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0, overrideAccess: true, disableErrors: true, req })) as {
      id: Id
      course: Rel
    } | null
    if (!lesson) throw new LmsError('Lesson not found.', 404)
    const course = await publishedCourse(payload, idOf(lesson.course), req)
    const enrolment = await lockedEnrolment(req, learner, course.id)
    const { totalDocs } = await payload.count({
      collection: 'lesson-progress',
      where: { and: [{ learner: { equals: learner } }, { lesson: { equals: lesson.id } }] },
      overrideAccess: true,
      req,
    })
    if (totalDocs === 0) {
      await payload.create({
        collection: 'lesson-progress',
        data: { tenant: idOf(course.tenant)!, learner, course: course.id, lesson: lesson.id, completedAt: now() },
        depth: 0,
        overrideAccess: true,
        req,
      })
    }
    return { lesson: lesson.id, ...(await evaluateCompletion(req, learner, course, enrolment)) }
  })
}

export type QuizSubmission = Completion & { quiz: Id; score: number; passed: boolean; correct: number; total: number; passingScore: number }

/** Score a quiz attempt on the server, record it, then evaluate the course. */
export async function submitQuiz(payload: Payload, learner: Id, quizId: Id, answers: unknown): Promise<QuizSubmission> {
  return inTransaction(payload, async (req) => {
    const quiz = (await payload.findByID({ collection: 'quizzes', id: quizId, depth: 0, overrideAccess: true, disableErrors: true, req })) as {
      id: Id
      course: Rel
      passingScore: number
      questions?: Array<{ correctIndex: number }> | null
    } | null
    if (!quiz) throw new LmsError('Quiz not found.', 404)
    const course = await publishedCourse(payload, idOf(quiz.course), req)
    const enrolment = await lockedEnrolment(req, learner, course.id)
    const result = scoreQuiz({ passingScore: quiz.passingScore, questions: quiz.questions ?? [] }, answers)
    await payload.create({
      collection: 'quiz-attempts',
      data: {
        tenant: idOf(course.tenant)!,
        learner,
        course: course.id,
        quiz: quiz.id,
        score: result.score,
        passed: result.passed,
        answers: result.answers,
        submittedAt: now(),
      },
      depth: 0,
      overrideAccess: true,
      req,
    })
    const completion = result.passed ? await evaluateCompletion(req, learner, course, enrolment) : { completed: enrolment.status === 'completed' }
    return {
      quiz: quiz.id,
      score: result.score,
      passed: result.passed,
      correct: result.correct,
      total: result.total,
      passingScore: quiz.passingScore,
      ...completion,
    }
  })
}

export type VerifiedCertificate = { serial: string; learner: string; course: string; academy: string; issuedAt: string }

/** Public verification: what a certificate says, by serial, and nothing else about the learner. */
export async function verifyCertificate(payload: Payload, serial: string): Promise<VerifiedCertificate> {
  const normalised = serial.trim().toUpperCase()
  if (!SERIAL_PATTERN.test(normalised)) throw new LmsError('Certificate not found.', 404)
  const { docs } = await payload.find({
    collection: 'certificates',
    where: { serial: { equals: normalised } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const cert = docs[0] as
    | { serial: string; issuedAt: string; learner: { name?: string } | Id; course: { title?: string } | Id; tenant: { name?: string } | Id }
    | undefined
  if (!cert) throw new LmsError('Certificate not found.', 404)
  const name = <T extends object>(rel: T | Id, key: keyof T) => (typeof rel === 'object' && rel ? String(rel[key] ?? '') : '')
  return {
    serial: cert.serial,
    learner: name(cert.learner, 'name'),
    course: name(cert.course, 'title'),
    academy: name(cert.tenant, 'name'),
    issuedAt: cert.issuedAt,
  }
}

export type MyCourse = {
  course: { id: Id; title: string; slug: string; academy: string; academySlug: string }
  status: string
  lessonsDone: number
  lessonsTotal: number
  certificate?: string
}

/** A learner's courses with progress, for /me and GET /api/lms/me. */
export async function myLearning(payload: Payload, learner: Id): Promise<MyCourse[]> {
  const all = { pagination: false, overrideAccess: true } as const
  const enrolments = await payload.find({ collection: 'enrolments', where: { learner: { equals: learner } }, depth: 2, sort: '-enrolledAt', ...all })
  if (enrolments.docs.length === 0) return []
  const courseIds = enrolments.docs.map((e) => idOf(e.course as Rel)!).filter(Boolean)
  const [lessons, progress, certs] = await Promise.all([
    payload.find({ collection: 'lessons', where: { course: { in: courseIds } }, depth: 0, select: { course: true }, ...all }),
    payload.find({ collection: 'lesson-progress', where: { learner: { equals: learner } }, depth: 0, select: { course: true }, ...all }),
    payload.find({ collection: 'certificates', where: { learner: { equals: learner } }, depth: 0, select: { course: true, serial: true }, ...all }),
  ])
  const count = (docs: Array<{ course?: unknown }>, course: Id) => docs.filter((d) => idOf(d.course as Rel) === course).length
  return enrolments.docs.map((e) => {
    const c = e.course as { id: Id; title?: string; slug?: string; tenant?: { name?: string; slug?: string } }
    const cert = certs.docs.find((d) => idOf(d.course as Rel) === c.id) as { serial?: string } | undefined
    return {
      course: { id: c.id, title: c.title ?? '', slug: c.slug ?? '', academy: c.tenant?.name ?? '', academySlug: c.tenant?.slug ?? '' },
      status: e.status as string,
      lessonsDone: count(progress.docs, c.id),
      lessonsTotal: count(lessons.docs, c.id),
      ...(cert?.serial ? { certificate: cert.serial } : {}),
    }
  })
}

import type { Payload } from 'payload'

import type { LearnerUser } from '../lib/lms-access'
import { asVisitor } from './session'
import type { Academy, CourseCard, CourseView, LessonRow, QuizRow } from './types'

export type { Academy, CourseCard, CourseView, LessonRow, QuizRow } from './types'

// The learner app's reads. Every one runs with the visitor's own access rules
// (asVisitor): what a page shows is exactly what the API would give the same
// person, so a page can never leak a lesson body or an answer key.

type Id = string
type Rel = Id | { id: Id } | null | undefined
const idOf = (rel: Rel): Id | undefined => (!rel ? undefined : typeof rel === 'string' ? rel : rel.id)

export async function publishedCourses(payload: Payload, learner: LearnerUser | undefined, academyId?: Id): Promise<CourseCard[]> {
  const { docs } = await payload.find({
    collection: 'courses',
    where: { and: [{ _status: { equals: 'published' } }, ...(academyId ? [{ tenant: { equals: academyId } }] : [])] },
    depth: 1,
    limit: 200,
    sort: 'title',
    ...asVisitor(learner),
  })
  return docs
    .map((c) => ({ ...(c as unknown as CourseCard), academy: c.tenant as unknown as Academy }))
    .filter((c) => c.academy && typeof c.academy === 'object')
    .sort((a, b) => a.academy.name.localeCompare(b.academy.name) || a.title.localeCompare(b.title))
}

export async function academyBySlug(payload: Payload, slug: string): Promise<Academy | undefined> {
  const { docs } = await payload.find({ collection: 'tenants', where: { slug: { equals: slug } }, depth: 0, limit: 1, overrideAccess: false })
  return docs[0] as Academy | undefined
}

/** A published course by academy and course slug, with the learner's own progress. */
export async function courseView(payload: Payload, learner: LearnerUser | undefined, academySlug: string, courseSlug: string): Promise<CourseView | undefined> {
  const academy = await academyBySlug(payload, academySlug)
  if (!academy) return undefined
  const visitor = asVisitor(learner)
  const { docs } = await payload.find({
    collection: 'courses',
    where: { and: [{ tenant: { equals: academy.id } }, { slug: { equals: courseSlug } }, { _status: { equals: 'published' } }] },
    depth: 0,
    limit: 1,
    ...visitor,
  })
  const course = docs[0] as unknown as (CourseCard & { coverUrl?: string | null }) | undefined
  if (!course) return undefined
  const byCourse = { course: { equals: course.id } }
  const [lessons, quizzes] = await Promise.all([
    payload.find({ collection: 'lessons', where: byCourse, depth: 0, sort: 'order', pagination: false, select: { title: true, slug: true, order: true, minutes: true }, ...visitor }),
    payload.find({ collection: 'quizzes', where: byCourse, depth: 0, sort: 'title', pagination: false, select: { title: true, slug: true, passingScore: true }, ...visitor }),
  ])
  const view: CourseView = {
    academy,
    course: { ...course, academy },
    lessons: lessons.docs as unknown as LessonRow[],
    quizzes: quizzes.docs as unknown as QuizRow[],
    completedLessons: new Set(),
    passedQuizzes: new Set(),
  }
  if (!learner) return view
  const mine = { and: [{ learner: { equals: learner.id } }, byCourse] }
  const [enrolments, progress, passed, certs] = await Promise.all([
    payload.find({ collection: 'enrolments', where: mine, depth: 0, limit: 1, ...visitor }),
    payload.find({ collection: 'lesson-progress', where: mine, depth: 0, pagination: false, ...visitor }),
    payload.find({ collection: 'quiz-attempts', where: { and: [...mine.and, { passed: { equals: true } }] }, depth: 0, pagination: false, ...visitor }),
    payload.find({ collection: 'certificates', where: mine, depth: 0, limit: 1, ...visitor }),
  ])
  const e = enrolments.docs[0] as { id: Id; status: string } | undefined
  if (e) view.enrolment = { id: e.id, status: e.status }
  view.completedLessons = new Set(progress.docs.map((d) => idOf(d.lesson as Rel)!).filter(Boolean))
  view.passedQuizzes = new Set(passed.docs.map((d) => idOf(d.quiz as Rel)!).filter(Boolean))
  const cert = certs.docs[0] as { serial?: string } | undefined
  if (cert?.serial) view.certificate = cert.serial
  return view
}

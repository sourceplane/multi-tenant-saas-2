import type { CourseView, LessonRow } from './types'

// Where the learner app sends a learner next. Pure: tests/cms exercises it.

/** Where to go after a lesson: the next lesson in order, else the first quiz not yet passed, else the course page. */
export function nextStep(view: CourseView, academySlug: string, after: LessonRow): string {
  const base = `/learn/${academySlug}/${view.course.slug}`
  const next = view.lessons[view.lessons.findIndex((l) => l.id === after.id) + 1]
  if (next) return `${base}/${next.slug}`
  const quiz = view.quizzes.find((q) => !view.passedQuizzes.has(q.id))
  if (quiz) return `${base}/quiz/${quiz.slug}`
  return `/courses/${academySlug}/${view.course.slug}`
}

/** The first thing to do in a course: the first unfinished lesson, else a quiz, else the first lesson. */
export function resumeAt(view: CourseView, academySlug: string): string {
  const base = `/learn/${academySlug}/${view.course.slug}`
  const lesson = view.lessons.find((l) => !view.completedLessons.has(l.id))
  if (lesson) return `${base}/${lesson.slug}`
  const quiz = view.quizzes.find((q) => !view.passedQuizzes.has(q.id))
  if (quiz) return `${base}/quiz/${quiz.slug}`
  const first = view.lessons[0]
  return first ? `${base}/${first.slug}` : `/courses/${academySlug}/${view.course.slug}`
}

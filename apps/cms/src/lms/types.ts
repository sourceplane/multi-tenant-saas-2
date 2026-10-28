// The learner app's view of a course. Types only: no imports, so pure modules
// and tests can use them without loading Payload.

type Id = string

export type Academy = { id: Id; name: string; slug: string; description?: string | null; enrolment?: string | null }
export type CourseCard = { id: Id; title: string; slug: string; summary?: string | null; level?: string | null; academy: Academy }
export type LessonRow = { id: Id; title: string; slug: string; order: number; minutes?: number | null }
export type QuizRow = { id: Id; title: string; slug: string; passingScore: number }

export type CourseView = {
  academy: Academy
  course: CourseCard & { coverUrl?: string | null }
  lessons: LessonRow[]
  quizzes: QuizRow[]
  enrolment?: { id: Id; status: string }
  completedLessons: Set<Id>
  passedQuizzes: Set<Id>
  certificate?: string
}

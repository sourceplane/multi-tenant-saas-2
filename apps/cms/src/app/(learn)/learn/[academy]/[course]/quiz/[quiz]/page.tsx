import { notFound, redirect } from 'next/navigation'

import { courseView } from '../../../../../../../lms/catalogue'
import { asVisitor, learnerSession } from '../../../../../../../lms/session'
import { QuizForm } from './QuizForm'

export const dynamic = 'force-dynamic'

type Params = { academy: string; course: string; quiz: string }

export default async function QuizPage({ params }: { params: Promise<Params> }) {
  const { academy, course, quiz: quizSlug } = await params
  const { payload, learner } = await learnerSession()
  const here = `/learn/${academy}/${course}/quiz/${quizSlug}`
  if (!learner) redirect(`/login?next=${encodeURIComponent(here)}`)
  const view = await courseView(payload, learner, academy, course)
  const row = view?.quizzes.find((q) => q.slug === quizSlug)
  if (!view || !row) notFound()
  const coursePage = `/courses/${academy}/${course}`
  if (!view.enrolment) redirect(coursePage)
  // Prompts and options through the learner's own access; the answer key is never readable here.
  const quiz = (await payload.findByID({ collection: 'quizzes', id: row.id, depth: 0, ...asVisitor(learner) })) as {
    id: string
    title: string
    passingScore: number
    questions?: Array<{ id: string; prompt: string; options?: Array<{ id: string; label: string }> | null }> | null
  }
  const { totalDocs: attempts } = await payload.count({
    collection: 'quiz-attempts',
    where: { and: [{ learner: { equals: learner.id } }, { quiz: { equals: quiz.id } }] },
    ...asVisitor(learner),
  })
  const questions = (quiz.questions ?? []).map((q) => ({ id: q.id, prompt: q.prompt, options: (q.options ?? []).map((o) => o.label) }))
  return (
    <article data-page="quiz">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={coursePage}>{view.course.title}</a> / Quiz
      </nav>
      <h1>{quiz.title}</h1>
      <p className="lede">
        {questions.length} question{questions.length === 1 ? '' : 's'}. Pass at {quiz.passingScore}%.
        {view.passedQuizzes.has(quiz.id) ? ' You have passed this quiz.' : attempts ? ` Attempts so far: ${attempts}.` : ''}
      </p>
      <QuizForm quizId={quiz.id} questions={questions} coursePage={coursePage} />
    </article>
  )
}

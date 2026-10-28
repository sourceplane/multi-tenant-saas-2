import { notFound } from 'next/navigation'

import { courseView } from '../../../../../lms/catalogue'
import { resumeAt } from '../../../../../lms/navigation'
import { learnerSession } from '../../../../../lms/session'
import { enrolAction } from '../../../actions'

export const dynamic = 'force-dynamic'

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ academy: string; course: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { academy, course } = await params
  const { error } = await searchParams
  const { payload, learner } = await learnerSession()
  const view = await courseView(payload, learner, academy, course)
  if (!view) notFound()
  const here = `/courses/${academy}/${course}`
  const done = view.completedLessons.size
  const total = view.lessons.length
  const minutes = view.lessons.reduce((n, l) => n + (l.minutes ?? 0), 0)
  const base = `/learn/${academy}/${course}`
  const enrolled = Boolean(view.enrolment)
  return (
    <div data-page="course">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/">Courses</a> / <a href={`/academies/${academy}`}>{view.academy.name}</a> / {view.course.title}
      </nav>
      <h1>{view.course.title}</h1>
      {view.course.summary ? <p className="lede">{view.course.summary}</p> : null}
      {error ? (
        <p className="notice warn" role="alert">
          {error}
        </p>
      ) : null}
      {view.certificate ? (
        <p className="notice ok">
          You completed this course. <a href={`/certificates/${view.certificate}`}>View your certificate</a>.
        </p>
      ) : null}

      <div className="panel">
        <div className="meta">
          <span>
            {total} lesson{total === 1 ? '' : 's'}
            {minutes ? ` · about ${minutes} minutes` : ''}
          </span>
          {view.quizzes.length ? (
            <span>
              {view.quizzes.length} quiz{view.quizzes.length === 1 ? '' : 'zes'}
            </span>
          ) : null}
          {enrolled ? <span className={view.enrolment!.status === 'completed' ? 'pill ok' : 'pill'}>{view.enrolment!.status === 'completed' ? 'Completed' : 'Enrolled'}</span> : null}
        </div>
        {enrolled && total ? (
          <>
            <p className="meta" id="progress-label">
              {done} of {total} lessons done
            </p>
            <div className="progress" role="progressbar" aria-labelledby="progress-label" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
              <span style={{ width: `${Math.round((done * 100) / total)}%` }} />
            </div>
          </>
        ) : null}
        <div className="actions">
          {enrolled ? (
            <a className="btn" href={resumeAt(view, academy)}>
              {done === 0 ? 'Start the course' : view.enrolment!.status === 'completed' ? 'Review the course' : 'Continue'}
            </a>
          ) : learner ? (
            <form action={enrolAction}>
              <input type="hidden" name="courseId" value={view.course.id} />
              <input type="hidden" name="back" value={here} />
              <input type="hidden" name="next" value={resumeAt(view, academy)} />
              <button className="btn" type="submit">
                Enrol for free
              </button>
            </form>
          ) : (
            <>
              <a className="btn" href={`/register?next=${encodeURIComponent(here)}`}>
                Create an account to enrol
              </a>
              <a className="btn secondary" href={`/login?next=${encodeURIComponent(here)}`}>
                Sign in
              </a>
            </>
          )}
        </div>
      </div>

      <h2>Lessons</h2>
      <ol className="outline">
        {view.lessons.map((l) => (
          <li key={l.id}>
            <span>
              {enrolled ? <a href={`${base}/${l.slug}`}>{l.title}</a> : l.title}
              {l.minutes ? <span className="aside"> · {l.minutes} min</span> : null}
            </span>
            {view.completedLessons.has(l.id) ? <span className="done">✓ Done</span> : enrolled ? <span className="todo">To do</span> : null}
          </li>
        ))}
      </ol>
      {view.quizzes.length ? (
        <>
          <h2>Quizzes</h2>
          <ul className="outline">
            {view.quizzes.map((q) => (
              <li key={q.id}>
                <span>
                  {enrolled ? <a href={`${base}/quiz/${q.slug}`}>{q.title}</a> : q.title}
                  <span className="aside"> · pass at {q.passingScore}%</span>
                </span>
                {view.passedQuizzes.has(q.id) ? <span className="done">✓ Passed</span> : enrolled ? <span className="todo">To do</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

import { redirect } from 'next/navigation'

import { myLearning } from '../../../lms/services'
import { learnerSession } from '../../../lms/session'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My learning' }

export default async function MyLearning() {
  const { payload, learner } = await learnerSession()
  if (!learner) redirect('/login?next=/me')
  const courses = await myLearning(payload, learner.id)
  return (
    <div data-page="me">
      <h1>My learning</h1>
      <p className="lede">Signed in as {learner.name ?? learner.email}.</p>
      {courses.length === 0 ? (
        <p>
          You are not enrolled in any course yet. <a href="/">Browse the courses</a>.
        </p>
      ) : (
        <ul className="grid">
          {courses.map((c) => {
            const pct = c.lessonsTotal ? Math.round((c.lessonsDone * 100) / c.lessonsTotal) : 0
            return (
              <li key={c.course.id} className="card">
                <h3>
                  <a href={`/courses/${c.course.academySlug}/${c.course.slug}`}>{c.course.title}</a>
                </h3>
                <div className="meta">
                  <span>{c.course.academy}</span>
                  <span className={c.status === 'completed' ? 'pill ok' : 'pill'}>{c.status === 'completed' ? 'Completed' : 'In progress'}</span>
                </div>
                <div className="progress" role="progressbar" aria-label={`${c.course.title}: ${c.lessonsDone} of ${c.lessonsTotal} lessons`} aria-valuemin={0} aria-valuemax={c.lessonsTotal} aria-valuenow={c.lessonsDone}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <p className="meta">
                  {c.lessonsDone} of {c.lessonsTotal} lessons
                </p>
                {c.certificate ? <a href={`/certificates/${c.certificate}`}>Certificate {c.certificate}</a> : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

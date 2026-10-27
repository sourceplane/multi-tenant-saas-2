import { publishedCourses } from '../../lms/catalogue'
import { learnerSession } from '../../lms/session'
import { CourseGrid } from './CourseGrid'

export const dynamic = 'force-dynamic'

export default async function Catalogue() {
  const { payload, learner } = await learnerSession()
  const courses = await publishedCourses(payload, learner)
  const academies = [...new Map(courses.map((c) => [c.academy.id, c.academy])).values()]
  return (
    <div data-page="catalogue">
      <h1>Courses</h1>
      <p className="lede">Learn at your own pace. Finish every lesson, pass the quiz, and earn a certificate anyone can verify.</p>
      {academies.length === 0 ? (
        <p>No courses are published yet.</p>
      ) : (
        academies.map((academy) => (
          <section key={academy.id} aria-labelledby={`academy-${academy.slug}`}>
            <h2 id={`academy-${academy.slug}`}>
              <a href={`/academies/${academy.slug}`}>{academy.name}</a>
            </h2>
            <CourseGrid courses={courses.filter((c) => c.academy.id === academy.id)} />
          </section>
        ))
      )}
    </div>
  )
}

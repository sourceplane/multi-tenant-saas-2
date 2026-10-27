import { notFound } from 'next/navigation'

import { academyBySlug, publishedCourses } from '../../../../lms/catalogue'
import { learnerSession } from '../../../../lms/session'
import { CourseGrid } from '../../CourseGrid'

export const dynamic = 'force-dynamic'

export default async function AcademyPage({ params }: { params: Promise<{ academy: string }> }) {
  const { academy: slug } = await params
  const { payload, learner } = await learnerSession()
  const academy = await academyBySlug(payload, slug)
  if (!academy) notFound()
  const courses = await publishedCourses(payload, learner, academy.id)
  return (
    <div data-page="academy">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/">Courses</a> / {academy.name}
      </nav>
      <h1>{academy.name}</h1>
      {academy.description ? <p className="lede">{academy.description}</p> : null}
      {academy.enrolment === 'closed' ? <p className="notice warn">This academy is not taking new enrolments.</p> : null}
      {courses.length === 0 ? <p>No courses are published here yet.</p> : <CourseGrid courses={courses} />}
    </div>
  )
}

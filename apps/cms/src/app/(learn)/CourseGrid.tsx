import type { CourseCard } from '../../lms/catalogue'

const LEVELS: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

export function CourseGrid({ courses }: { courses: CourseCard[] }) {
  return (
    <ul className="grid">
      {courses.map((c) => (
        <li key={c.id} className="card">
          <h3>
            <a href={`/courses/${c.academy.slug}/${c.slug}`}>{c.title}</a>
          </h3>
          {c.summary ? <p>{c.summary}</p> : null}
          <div className="meta">
            {c.level ? <span className="pill">{LEVELS[c.level] ?? c.level}</span> : null}
            <span>{c.academy.name}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

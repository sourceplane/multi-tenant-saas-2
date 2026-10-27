import { RichText } from '@payloadcms/richtext-lexical/react'
import { notFound, redirect } from 'next/navigation'

import { courseView } from '../../../../../../lms/catalogue'
import { nextStep } from '../../../../../../lms/navigation'
import { asVisitor, learnerSession } from '../../../../../../lms/session'
import { videoEmbed } from '../../../../../../lms/video'
import { completeLessonAction } from '../../../../actions'

export const dynamic = 'force-dynamic'

type Params = { academy: string; course: string; lesson: string }

export default async function LessonPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ error?: string }> }) {
  const { academy, course, lesson: lessonSlug } = await params
  const { error } = await searchParams
  const { payload, learner } = await learnerSession()
  const here = `/learn/${academy}/${course}/${lessonSlug}`
  if (!learner) redirect(`/login?next=${encodeURIComponent(here)}`)
  const view = await courseView(payload, learner, academy, course)
  const row = view?.lessons.find((l) => l.slug === lessonSlug)
  if (!view || !row) notFound()
  const coursePage = `/courses/${academy}/${course}`
  if (!view.enrolment) redirect(coursePage)
  // Read through the learner's own access: the body is there because they are enrolled.
  const lesson = (await payload.findByID({ collection: 'lessons', id: row.id, depth: 0, ...asVisitor(learner) })) as {
    title: string
    content?: Parameters<typeof RichText>[0]['data'] | null
    videoUrl?: string | null
  }
  const video = videoEmbed(lesson.videoUrl)
  const index = view.lessons.findIndex((l) => l.id === row.id)
  const done = view.completedLessons.has(row.id)
  const next = nextStep(view, academy, row)
  return (
    <article data-page="lesson">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={coursePage}>{view.course.title}</a> / Lesson {index + 1} of {view.lessons.length}
      </nav>
      <h1>{lesson.title}</h1>
      {error ? (
        <p className="notice warn" role="alert">
          {error}
        </p>
      ) : null}
      {video?.kind === 'iframe' ? (
        <iframe className="video" src={video.src} title={`Video: ${lesson.title}`} allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" />
      ) : video?.kind === 'file' ? (
        <video className="video" src={video.src} controls preload="metadata" />
      ) : video?.kind === 'link' ? (
        <p>
          <a href={video.href} rel="noopener noreferrer" target="_blank">
            Watch the video
          </a>
        </p>
      ) : null}
      <div className="prose">{lesson.content ? <RichText data={lesson.content} /> : <p>This lesson has no text yet.</p>}</div>
      <div className="actions">
        {done ? (
          <>
            <span className="done">✓ You completed this lesson</span>
            <a className="btn" href={next}>
              Next
            </a>
          </>
        ) : (
          <form action={completeLessonAction}>
            <input type="hidden" name="lessonId" value={row.id} />
            <input type="hidden" name="back" value={here} />
            <input type="hidden" name="next" value={next} />
            <button className="btn" type="submit">
              Mark complete and continue
            </button>
          </form>
        )}
        <a className="btn secondary" href={coursePage}>
          Course outline
        </a>
      </div>
    </article>
  )
}

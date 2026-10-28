import type { CourseView } from '@cms/lms/types'
import { nextStep, resumeAt } from '@cms/lms/navigation'
import { videoEmbed } from '@cms/lms/video'

describe('videoEmbed', () => {
  it('embeds YouTube through its privacy-enhanced domain', () => {
    const embed = { kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }
    expect(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual(embed)
    expect(videoEmbed('https://youtu.be/dQw4w9WgXcQ')).toEqual(embed)
    expect(videoEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual(embed)
    expect(videoEmbed('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toEqual(embed)
  })

  it('embeds Vimeo', () => {
    expect(videoEmbed('https://vimeo.com/76979871')).toEqual({ kind: 'iframe', src: 'https://player.vimeo.com/video/76979871' })
  })

  it('plays a direct file, and links anything else', () => {
    expect(videoEmbed('https://cdn.example.com/a/intro.mp4')).toEqual({ kind: 'file', src: 'https://cdn.example.com/a/intro.mp4' })
    expect(videoEmbed('https://example.com/talk')).toEqual({ kind: 'link', href: 'https://example.com/talk' })
  })

  it('uses nothing that is not https, and nothing malformed', () => {
    expect(videoEmbed('http://youtube.com/watch?v=dQw4w9WgXcQ')).toBeUndefined()
    expect(videoEmbed('javascript:alert(1)')).toBeUndefined()
    expect(videoEmbed('data:text/html,<script>')).toBeUndefined()
    expect(videoEmbed('not a url')).toBeUndefined()
    expect(videoEmbed('')).toBeUndefined()
    expect(videoEmbed(null)).toBeUndefined()
  })

  it('does not pass arbitrary text into an embed URL', () => {
    expect(videoEmbed('https://www.youtube.com/watch?v=x"><script>')).toEqual({ kind: 'link', href: 'https://www.youtube.com/watch?v=x%22%3E%3Cscript%3E' })
  })
})

describe('navigation', () => {
  const lesson = (n: number) => ({ id: `l${n}`, title: `L${n}`, slug: `lesson-${n}`, order: n })
  const view = (done: string[] = [], passed: string[] = [], quizzes = true): CourseView =>
    ({
      academy: { id: 'a', name: 'A', slug: 'a' },
      course: { id: 'c', title: 'C', slug: 'course', academy: { id: 'a', name: 'A', slug: 'a' } },
      lessons: [lesson(1), lesson(2), lesson(3)],
      quizzes: quizzes ? [{ id: 'q1', title: 'Q', slug: 'quiz-1', passingScore: 70 }] : [],
      completedLessons: new Set(done),
      passedQuizzes: new Set(passed),
    }) as CourseView

  it('after a lesson: the next lesson, then the quiz, then the course page', () => {
    expect(nextStep(view(), 'a', lesson(1))).toBe('/learn/a/course/lesson-2')
    expect(nextStep(view(), 'a', lesson(3))).toBe('/learn/a/course/quiz/quiz-1')
    expect(nextStep(view([], ['q1']), 'a', lesson(3))).toBe('/courses/a/course')
    expect(nextStep(view([], [], false), 'a', lesson(3))).toBe('/courses/a/course')
  })

  it('resume: the first unfinished lesson, then an unpassed quiz, then the first lesson', () => {
    expect(resumeAt(view(), 'a')).toBe('/learn/a/course/lesson-1')
    expect(resumeAt(view(['l1']), 'a')).toBe('/learn/a/course/lesson-2')
    expect(resumeAt(view(['l1', 'l2', 'l3']), 'a')).toBe('/learn/a/course/quiz/quiz-1')
    expect(resumeAt(view(['l1', 'l2', 'l3'], ['q1']), 'a')).toBe('/learn/a/course/lesson-1')
  })
})

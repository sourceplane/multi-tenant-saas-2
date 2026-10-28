import { isCourseComplete, newSerial, scoreQuiz, SERIAL_PATTERN } from '@cms/lms/rules'

const key = { passingScore: 70, questions: [{ correctIndex: 1 }, { correctIndex: 0 }, { correctIndex: 2 }] }

describe('scoreQuiz (server-side scoring)', () => {
  it('scores all right, some right, none right', () => {
    expect(scoreQuiz(key, [1, 0, 2])).toEqual({ score: 100, passed: true, correct: 3, total: 3, answers: [1, 0, 2] })
    expect(scoreQuiz(key, [1, 0, 0])).toMatchObject({ score: 67, passed: false, correct: 2 })
    expect(scoreQuiz(key, [0, 1, 0])).toMatchObject({ score: 0, passed: false, correct: 0 })
  })

  it('passes at exactly the passing score', () => {
    const k = { passingScore: 50, questions: [{ correctIndex: 0 }, { correctIndex: 0 }] }
    expect(scoreQuiz(k, [0, 1])).toMatchObject({ score: 50, passed: true })
  })

  it('counts missing, extra and malformed answers as wrong, and normalises what it stores', () => {
    expect(scoreQuiz(key, [1])).toMatchObject({ correct: 1, answers: [1, -1, -1] })
    expect(scoreQuiz(key, [1, 0, 2, 3, 4])).toMatchObject({ correct: 3, answers: [1, 0, 2] })
    expect(scoreQuiz(key, ['1', 0.5, -2])).toMatchObject({ correct: 0, answers: [-1, -1, -1] })
    expect(scoreQuiz(key, 'nope')).toMatchObject({ correct: 0, answers: [-1, -1, -1] })
    expect(scoreQuiz(key, null)).toMatchObject({ correct: 0 })
  })

  it('never passes a quiz with no questions', () => {
    expect(scoreQuiz({ passingScore: 0, questions: [] }, [])).toMatchObject({ score: 0, passed: false, total: 0 })
  })
})

describe('isCourseComplete', () => {
  const lessons = ['l1', 'l2', 'l3']
  const quizzes = ['q1']

  it('needs every lesson and every quiz', () => {
    expect(isCourseComplete({ lessonIds: lessons, quizIds: quizzes, completedLessonIds: lessons, passedQuizIds: quizzes })).toBe(true)
    expect(isCourseComplete({ lessonIds: lessons, quizIds: quizzes, completedLessonIds: ['l1', 'l2'], passedQuizIds: quizzes })).toBe(false)
    expect(isCourseComplete({ lessonIds: lessons, quizIds: quizzes, completedLessonIds: lessons, passedQuizIds: [] })).toBe(false)
  })

  it('ignores progress on lessons that are not in the course, and duplicates', () => {
    expect(isCourseComplete({ lessonIds: ['l1'], quizIds: [], completedLessonIds: ['l1', 'l1', 'other'], passedQuizIds: [] })).toBe(true)
  })

  it('works for lesson-only and quiz-only courses', () => {
    expect(isCourseComplete({ lessonIds: ['l1'], quizIds: [], completedLessonIds: ['l1'], passedQuizIds: [] })).toBe(true)
    expect(isCourseComplete({ lessonIds: [], quizIds: ['q1'], completedLessonIds: [], passedQuizIds: ['q1'] })).toBe(true)
  })

  it('never completes an empty course', () => {
    expect(isCourseComplete({ lessonIds: [], quizIds: [], completedLessonIds: [], passedQuizIds: [] })).toBe(false)
  })
})

describe('newSerial', () => {
  it('is XXXX-XXXX-XXXX in Crockford base32', () => {
    for (let i = 0; i < 200; i++) expect(newSerial()).toMatch(SERIAL_PATTERN)
  })

  it('uses its randomness, and does not repeat in practice', () => {
    expect(newSerial((b) => b.fill(0))).toBe('0000-0000-0000')
    expect(newSerial((b) => b.fill(31))).toBe('ZZZZ-ZZZZ-ZZZZ')
    const seen = new Set(Array.from({ length: 2000 }, () => newSerial()))
    expect(seen.size).toBe(2000)
  })

  it('has no ambiguous letters', () => {
    expect(SERIAL_PATTERN.test('ILOU-0000-0000')).toBe(false)
  })
})

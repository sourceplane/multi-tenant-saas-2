// The learning domain's rules, as pure functions: scoring a quiz, deciding
// whether a course is complete, minting a certificate serial. No Payload
// imports: tests/cms exercises them directly.

export type QuizKey = { passingScore: number; questions: Array<{ correctIndex: number }> }

export type QuizResult = { score: number; passed: boolean; correct: number; total: number; answers: number[] }

/**
 * Scores answers (zero-based option per question) against the key, on the
 * server. Missing, extra, non-integer or out-of-range answers count as wrong;
 * the stored answers are normalised to one integer per question, -1 for none.
 */
export function scoreQuiz(key: QuizKey, submitted: unknown): QuizResult {
  const total = key.questions.length
  const given = Array.isArray(submitted) ? submitted : []
  const answers = key.questions.map((_, i) => {
    const a = given[i]
    return typeof a === 'number' && Number.isInteger(a) && a >= 0 ? a : -1
  })
  const correct = key.questions.reduce((n, q, i) => n + (answers[i] === q.correctIndex ? 1 : 0), 0)
  const score = total === 0 ? 0 : Math.round((correct * 100) / total)
  return { score, passed: total > 0 && score >= key.passingScore, correct, total, answers }
}

/**
 * A course is complete when every lesson has the learner's progress and every
 * quiz has a passing attempt. A course with nothing in it is never complete:
 * there is nothing to certify.
 */
export function isCourseComplete(args: {
  lessonIds: string[]
  quizIds: string[]
  completedLessonIds: Iterable<string>
  passedQuizIds: Iterable<string>
}): boolean {
  const { lessonIds, quizIds } = args
  if (lessonIds.length === 0 && quizIds.length === 0) return false
  const done = new Set(args.completedLessonIds)
  const passed = new Set(args.passedQuizIds)
  return lessonIds.every((id) => done.has(id)) && quizIds.every((id) => passed.has(id))
}

// Crockford base32: no I, L, O or U, so a serial read aloud or retyped is
// unambiguous.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** A certificate serial: 60 random bits as XXXX-XXXX-XXXX. */
export function newSerial(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(12))
  let out = ''
  for (let i = 0; i < 12; i++) out += ALPHABET[bytes[i]! & 31]
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`
}

export const SERIAL_PATTERN = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

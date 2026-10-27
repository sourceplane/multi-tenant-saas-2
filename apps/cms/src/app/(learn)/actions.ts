'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { completeLesson, enrol, LmsError, submitQuiz } from '../../lms/services'
import { learnerSession, tokenCookieName } from '../../lms/session'

// The learner app's writes. Each calls the same transactional service as
// /api/lms/*; Next checks a server action's Origin against its host, so a
// cross-site page cannot invoke these.

const safeNext = (value: FormDataEntryValue | null, fallback = '/me') => {
  const next = typeof value === 'string' ? value : ''
  return next.startsWith('/') && !next.startsWith('//') ? next : fallback
}

async function setSession(token: string, exp: number | undefined) {
  const { payload } = await learnerSession()
  const origin = (await headers()).get('origin') ?? ''
  ;(await cookies()).set(tokenCookieName(payload), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https://'),
    path: '/',
    ...(exp ? { expires: new Date(exp * 1000) } : {}),
  })
}

export type FormState = { error?: string }

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim()
  const password = String(form.get('password') ?? '')
  if (!email || !password) return { error: 'Enter your email and password.' }
  const { payload } = await learnerSession()
  let result
  try {
    result = await payload.login({ collection: 'learners', data: { email, password } })
  } catch {
    return { error: 'That email and password do not match an account.' }
  }
  if (!result.token) return { error: 'That email and password do not match an account.' }
  await setSession(result.token, result.exp)
  redirect(safeNext(form.get('next')))
}

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get('name') ?? '').trim()
  const email = String(form.get('email') ?? '').trim()
  const password = String(form.get('password') ?? '')
  if (!name) return { error: 'Enter your name as it should appear on certificates.' }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' }
  if (password.length < 10) return { error: 'Use a password of at least 10 characters.' }
  const { payload } = await learnerSession()
  try {
    await payload.create({ collection: 'learners', data: { name, email, password }, overrideAccess: false })
  } catch {
    return { error: 'An account with that email already exists. Sign in instead.' }
  }
  const result = await payload.login({ collection: 'learners', data: { email, password } })
  if (result.token) await setSession(result.token, result.exp)
  redirect(safeNext(form.get('next'), '/'))
}

export async function signOut() {
  const { payload } = await learnerSession()
  ;(await cookies()).delete(tokenCookieName(payload))
  redirect('/')
}

/** Back to the page with the service's message, for refusals a learner can act on. */
const withError = (path: string, err: unknown): never => {
  if (!(err instanceof LmsError)) throw err
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(err.message)}`)
}

export async function enrolAction(form: FormData) {
  const { payload, learner } = await learnerSession()
  const courseId = String(form.get('courseId') ?? '')
  const back = safeNext(form.get('back'), '/')
  if (!learner) redirect(`/login?next=${encodeURIComponent(back)}`)
  try {
    await enrol(payload, learner.id, courseId)
  } catch (err) {
    withError(back, err)
  }
  redirect(safeNext(form.get('next'), back))
}

export async function completeLessonAction(form: FormData) {
  const { payload, learner } = await learnerSession()
  const back = safeNext(form.get('back'), '/')
  if (!learner) redirect(`/login?next=${encodeURIComponent(back)}`)
  let serial: string | undefined
  try {
    serial = (await completeLesson(payload, learner.id, String(form.get('lessonId') ?? ''))).certificate?.serial
  } catch (err) {
    withError(back, err)
  }
  if (serial) redirect(`/certificates/${serial}?new=1`)
  redirect(safeNext(form.get('next'), back))
}

export type QuizState = {
  /** Increments per submission: the form remounts (clears its choices) after each. */
  attempt?: number
  error?: string
  result?: { score: number; passed: boolean; correct: number; total: number; passingScore: number; certificate?: string }
}

export async function submitQuizAction(prev: QuizState, form: FormData): Promise<QuizState> {
  const attempt = (prev.attempt ?? 0) + 1
  const { payload, learner } = await learnerSession()
  if (!learner) return { attempt, error: 'Sign in to take the quiz.' }
  const count = Number(form.get('questionCount') ?? 0)
  const answers = Array.from({ length: Math.max(0, Math.min(count, 200)) }, (_, i) => {
    const v = form.get(`q${i}`)
    return v === null ? -1 : Number(v)
  })
  try {
    const r = await submitQuiz(payload, learner.id, String(form.get('quizId') ?? ''), answers)
    return {
      attempt,
      result: {
        score: r.score,
        passed: r.passed,
        correct: r.correct,
        total: r.total,
        passingScore: r.passingScore,
        ...(r.certificate ? { certificate: r.certificate.serial } : {}),
      },
    }
  } catch (err) {
    return { attempt, error: err instanceof LmsError ? err.message : 'Something went wrong. Try again.' }
  }
}

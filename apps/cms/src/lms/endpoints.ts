import type { Endpoint, PayloadRequest } from 'payload'

import { asLearner, type LearnerUser } from '../lib/lms-access'
import { completeLesson, enrol, LmsError, myLearning, submitQuiz, verifyCertificate } from './services'

// /api/lms/*: the learner-facing services (design §3). Each answers JSON; a
// learner session (Payload's `learners` auth: the payload-token cookie or an
// `Authorization: JWT …` header) is required except to verify a certificate.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

type Handler = (req: PayloadRequest, learner: LearnerUser) => Promise<unknown>

function asLearnerEndpoint(fn: Handler): Endpoint['handler'] {
  return async (req) => {
    const learner = asLearner(req.user)
    if (!learner) return json({ error: 'Sign in as a learner first.' }, 401)
    // A cross-site form cannot send JSON without a CORS preflight, and the
    // learner cookie is SameSite=Lax: together, no cross-site write.
    if (req.method === 'POST' && !(req.headers.get('content-type') ?? '').includes('application/json')) {
      return json({ error: 'Send JSON (content-type: application/json).' }, 415)
    }
    try {
      return json(await fn(req, learner))
    } catch (err) {
      return failure(req, err)
    }
  }
}

function failure(req: PayloadRequest, err: unknown) {
  if (err instanceof LmsError) return json({ error: err.message }, err.status)
  req.payload.logger.error({ err, msg: 'lms service failed' })
  return json({ error: 'Something went wrong. Try again.' }, 500)
}

async function body(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const parsed = (await req.json?.()) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const param = (req: PayloadRequest, name: string) => String((req.routeParams as Record<string, unknown> | undefined)?.[name] ?? '')

export const lmsEndpoints: Endpoint[] = [
  {
    path: '/lms/enrol',
    method: 'post',
    handler: asLearnerEndpoint(async (req, learner) => {
      const { courseId } = await body(req)
      if (typeof courseId !== 'string' || !courseId) throw new LmsError('courseId is required.', 400)
      return enrol(req.payload, learner.id, courseId)
    }),
  },
  {
    path: '/lms/lessons/:id/complete',
    method: 'post',
    handler: asLearnerEndpoint((req, learner) => completeLesson(req.payload, learner.id, param(req, 'id'))),
  },
  {
    path: '/lms/quizzes/:id/attempt',
    method: 'post',
    handler: asLearnerEndpoint(async (req, learner) => {
      const { answers } = await body(req)
      if (!Array.isArray(answers)) throw new LmsError('answers must be a list of option numbers.', 400)
      return submitQuiz(req.payload, learner.id, param(req, 'id'), answers)
    }),
  },
  {
    path: '/lms/me',
    method: 'get',
    handler: asLearnerEndpoint(async (req, learner) => ({ courses: await myLearning(req.payload, learner.id) })),
  },
  {
    // Public: anyone holding a serial can check what it certifies.
    path: '/lms/certificates/:serial',
    method: 'get',
    handler: async (req) => {
      try {
        return json(await verifyCertificate(req.payload, param(req, 'serial')))
      } catch (err) {
        return failure(req, err)
      }
    },
  },
]

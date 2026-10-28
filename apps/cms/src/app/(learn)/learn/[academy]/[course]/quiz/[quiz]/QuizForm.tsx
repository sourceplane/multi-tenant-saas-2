'use client'

import { useActionState } from 'react'

import { submitQuizAction, type QuizState } from '../../../../../actions'

type Question = { id: string; prompt: string; options: string[] }

export function QuizForm({ quizId, questions, coursePage }: { quizId: string; questions: Question[]; coursePage: string }) {
  const [state, action, pending] = useActionState<QuizState, FormData>(submitQuizAction, {})
  const result = state.result
  return (
    <>
      {result ? (
        <div className={`notice ${result.passed ? 'ok' : 'warn'}`} role="status" aria-live="polite">
          <strong>
            {result.passed ? 'Passed' : 'Not passed yet'}: {result.score}%
          </strong>{' '}
          ({result.correct} of {result.total} correct; {result.passingScore}% to pass).{' '}
          {result.certificate ? (
            <>
              You completed the course. <a href={`/certificates/${result.certificate}?new=1`}>See your certificate</a>.
            </>
          ) : result.passed ? (
            <a href={coursePage}>Back to the course</a>
          ) : (
            'Review the lessons and try again.'
          )}
        </div>
      ) : null}
      {state.error ? (
        <p className="notice warn" role="alert">
          {state.error}
        </p>
      ) : null}
      <form action={action} key={`attempt-${state.attempt ?? 0}`}>
        <input type="hidden" name="quizId" value={quizId} />
        <input type="hidden" name="questionCount" value={questions.length} />
        {questions.map((q, i) => (
          <fieldset key={q.id} className="q">
            <legend>
              {i + 1}. {q.prompt}
            </legend>
            {q.options.map((label, j) => (
              <label key={j} className="option">
                <input type="radio" name={`q${i}`} value={j} required />
                {label}
              </label>
            ))}
          </fieldset>
        ))}
        <div className="actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'Checking…' : result ? 'Try again' : 'Submit answers'}
          </button>
          <a className="btn secondary" href={coursePage}>
            Course outline
          </a>
        </div>
      </form>
    </>
  )
}

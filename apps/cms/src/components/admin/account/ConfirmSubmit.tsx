'use client'

import type React from 'react'

// A submit button that asks first (plan changes and cancellations): the only
// client code on Billing & plan. Without JavaScript the form still submits.
export function ConfirmSubmit({
  message,
  className,
  children,
  testId,
}: {
  message: string
  className?: string
  children: React.ReactNode
  testId?: string
}) {
  return (
    <button
      type="submit"
      className={className}
      data-testid={testId}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault()
      }}
    >
      {children}
    </button>
  )
}

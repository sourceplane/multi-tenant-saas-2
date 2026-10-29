'use client'

import { useEffect, useRef } from 'react'

// Back from the provider's checkout (lumen-payload-console design §4): bring
// the plan up to date once, through the same same-origin form post as every
// other change, so opening a link to this page changes nothing by itself.
// Without JavaScript the button does the same.
export function FinishCheckout({ orgId }: { orgId: string }) {
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    form.current?.requestSubmit()
  }, [])
  return (
    <form ref={form} method="post" action="/lumen/billing" data-testid="checkout-return">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="action" value="reconcile" />
      <p>Thanks: finishing your checkout…</p>
      <button type="submit" className="btn btn--style-secondary btn--size-small">
        Show my new plan
      </button>
    </form>
  )
}

import { formDeps } from '@/lib/lumen/form-deps'
import { billingForm } from '@/lib/lumen/forms'

export const dynamic = 'force-dynamic'

// The Billing & plan page's forms (lumen-payload-console design §4).
export function POST(request: Request): Promise<Response> {
  return billingForm(request, formDeps)
}

import { formDeps } from '@/lib/lumen/form-deps'
import { notificationsForm } from '@/lib/lumen/forms'

export const dynamic = 'force-dynamic'

// The Notifications page's form (lumen-payload-console design §4).
export function POST(request: Request): Promise<Response> {
  return notificationsForm(request, formDeps)
}

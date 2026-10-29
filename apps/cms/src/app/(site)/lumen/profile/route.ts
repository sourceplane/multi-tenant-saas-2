import { formDeps } from '@/lib/lumen/form-deps'
import { profileForm } from '@/lib/lumen/forms'

export const dynamic = 'force-dynamic'

// The Profile page's form (lumen-payload-console design §4).
export function POST(request: Request): Promise<Response> {
  return profileForm(request, formDeps)
}

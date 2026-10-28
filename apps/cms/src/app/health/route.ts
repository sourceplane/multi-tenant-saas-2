import config from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

const noStore = { 'cache-control': 'no-store' }

// Liveness plus a real round trip through HYPERDRIVE_CMS to schema `cms`: a
// count on `users` touches the binding, the connection and the migrated table,
// so a 200 here means the CMS can actually serve. The component's smokeCommand
// asserts it after every deploy. A 503 names the part that failed, without
// detail: the Worker's logs carry the error.
export async function GET(): Promise<Response> {
  // Payload refuses to start without its secret; say so rather than blame the
  // database. secrets-live pushes it right after a first deploy.
  if (!process.env.PAYLOAD_SECRET) {
    console.error(JSON.stringify({ level: 'error', msg: 'health check failed', error: 'PAYLOAD_SECRET is not set' }))
    return Response.json({ status: 'degraded', secret: 'missing' }, { status: 503, headers: noStore })
  }
  let payload
  try {
    payload = await getPayload({ config })
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'health check failed: payload init', error: String(error) }))
    return Response.json({ status: 'degraded', payload: 'error' }, { status: 503, headers: noStore })
  }
  try {
    await payload.count({ collection: 'users', overrideAccess: true })
    return Response.json({ status: 'ok', db: 'ok' }, { headers: noStore })
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'health check failed: database', error: String(error) }))
    return Response.json({ status: 'degraded', db: 'error' }, { status: 503, headers: noStore })
  }
}

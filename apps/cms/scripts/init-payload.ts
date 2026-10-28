// Initialises Payload once against DATABASE_URL and exits. With
// PAYLOAD_PUSH=true (and NODE_ENV not production) Payload pushes its schema to
// that database: the runbook uses it to check that a converted migration
// produces exactly the schema Payload itself would. Never run it against a
// deployed database: the deployed CMS takes its schema from db-migrate only.
import config from '@payload-config'
import { getPayload } from 'payload'

const payload = await getPayload({ config })
const collections = Object.keys(payload.collections)
console.log(JSON.stringify({ initialised: true, collections }))
process.exit(0)

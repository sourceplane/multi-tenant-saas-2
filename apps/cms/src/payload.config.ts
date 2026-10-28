import path from 'path'
import { fileURLToPath } from 'url'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import { buildConfig } from 'payload'

import { Categories } from './collections/Categories'
import { Courses } from './collections/lms/Courses'
import { Learners } from './collections/lms/Learners'
import { Lessons } from './collections/lms/Lessons'
import { Quizzes } from './collections/lms/Quizzes'
import { Certificates, Enrolments, LessonProgress, QuizAttempts } from './collections/lms/records'
import { Tenants } from './collections/lms/Tenants'
import { Media, MEDIA_UPLOAD_OPTIONS } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { cloudflareLogger } from './lib/logger'
import { lmsEndpoints } from './lms/endpoints'
import { mediaBucketFrom } from './lib/media-bucket'
import { requestScopedPg } from './lib/request-scoped-pool'
import { isWorkersRuntime } from './lib/runtime'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// On Workers the database is the HYPERDRIVE_CMS binding: a cache-DISABLED
// Hyperdrive config (infra/terraform/cloudflare-hyperdrive-cms), because an
// editor reads back what they just saved and Hyperdrive never invalidates a
// cached read on write. Everywhere else — `next build`, the payload CLI, local
// development — it is DATABASE_URL. `next build` never opens it: every route
// is dynamic.
const workersEnv = isWorkersRuntime() ? (await getCloudflareContext({ async: true })).env : undefined

async function resolveConnectionString(): Promise<string> {
  if (workersEnv) {
    const env = workersEnv
    if (env.HYPERDRIVE_CMS?.connectionString) return env.HYPERDRIVE_CMS.connectionString
    // A Worker without its binding cannot serve: say so, and let /health
    // answer 503 so the deploy's smoke check fails instead of the module.
    console.error(JSON.stringify({ level: 'error', msg: 'HYPERDRIVE_CMS binding is missing; the CMS has no database' }))
  }
  return process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:54329/cms'
}
const connectionString = await resolveConnectionString()

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' — CMS' },
  },
  collections: [
    Users,
    Pages,
    Posts,
    Categories,
    Tenants,
    Courses,
    Lessons,
    Quizzes,
    Learners,
    Enrolments,
    LessonProgress,
    QuizAttempts,
    Certificates,
    // Last, so Payload's own schema puts media_id last in its lock table,
    // where migration 320's ALTER TABLE ... ADD COLUMN puts it.
    Media,
  ],
  endpoints: lmsEndpoints,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  graphQL: { disablePlaygroundInProduction: true },
  telemetry: false,
  upload: MEDIA_UPLOAD_OPTIONS,
  plugins: [
    // Uploads live in the CMS's R2 bucket, never on a disk. On Workers the
    // adapter is always on: without the R2_MEDIA binding every upload fails
    // naming it (lib/media-bucket.ts). Off Workers (local `next dev`, the
    // payload CLI, `next build`) it is off and Payload's local disk storage
    // stands in; no prefix is configured, so the table is the same either way.
    r2Storage({
      enabled: Boolean(workersEnv),
      bucket: mediaBucketFrom(workersEnv),
      collections: { media: true },
    }),
  ],
  logger: isWorkersRuntime() ? cloudflareLogger : undefined,
  db: postgresAdapter({
    // Every table lives in schema `cms`, created by migration
    // 200_cms_payload_core through the db-migrate lane. The CMS never alters
    // its own schema at runtime: PAYLOAD_PUSH=true is only for generating
    // that migration against a local database.
    schemaName: 'cms',
    idType: 'uuid',
    push: process.env.PAYLOAD_PUSH === 'true',
    // Payload's own migration files and schema snapshot. They are never run:
    // scripts/payload-migration-to-sql.mjs turns each into a db-migrate
    // migration, and the snapshot is what the next `migrate:create` diffs.
    migrationDir: path.resolve(dirname, '../payload-migrations'),
    // On Workers, no client-side pooling: see lib/request-scoped-pool.ts.
    // Hyperdrive pools the connections to Postgres instead.
    pg: isWorkersRuntime() ? requestScopedPg : undefined,
    pool: {
      connectionString,
      connectionTimeoutMillis: 10_000,
      // A stuck query fails instead of holding the request open.
      query_timeout: 25_000,
    },
  }),
})

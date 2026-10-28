import path from 'path'
import { fileURLToPath } from 'url'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'

import { Categories } from './collections/Categories'
import { Courses } from './collections/lms/Courses'
import { Learners } from './collections/lms/Learners'
import { Lessons } from './collections/lms/Lessons'
import { Quizzes } from './collections/lms/Quizzes'
import { Certificates, Enrolments, LessonProgress, QuizAttempts } from './collections/lms/records'
import { Tenants } from './collections/lms/Tenants'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { cloudflareLogger } from './lib/logger'
import { lmsEndpoints } from './lms/endpoints'
import { requestScopedPg } from './lib/request-scoped-pool'
import { isWorkersRuntime } from './lib/runtime'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// On Workers the database is the HYPERDRIVE_CMS binding: a cache-DISABLED
// Hyperdrive config (infra/terraform/cloudflare-hyperdrive-cms), because an
// editor reads back what they just saved and Hyperdrive never invalidates a
// cached read on write. Everywhere else — `next build`, the payload CLI, local
// development — it is DATABASE_URL. `next build` never opens it: every route
// is dynamic.
async function resolveConnectionString(): Promise<string> {
  if (isWorkersRuntime()) {
    const { env } = await getCloudflareContext({ async: true })
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
    meta: { titleSuffix: ' — Multi Tenant Saas 2' },
    // Lumen sign-in replaces Payload's password views for staff
    // (multi-tenant-saas-2-console design §1–§2): Payload's local strategy is
    // off on `users`. Learners keep their own sign-in in the academy.
    components: {
      // The Lumen account pages (multi-tenant-saas-2-console LX2): Payload's
      // account view becomes the Lumen profile, and the rest are custom views
      // under an Account group in the nav.
      afterNavLinks: ['/components/admin/account/AccountNav#AccountNav'],
      graphics: { Logo: '/components/admin/Brand#Logo', Icon: '/components/admin/Brand#Icon' },
      views: {
        login: { Component: '/components/admin/LumenLogin#LumenLogin' },
        unauthorized: { Component: '/components/admin/PendingAccess#PendingAccess' },
        logout: { Component: '/components/admin/LumenSignOut#LumenSignOut' },
        account: { Component: '/components/admin/account/ProfileView#ProfileView' },
        lumenSecurity: { Component: '/components/admin/account/SecurityView#SecurityView', path: '/account/security', exact: true },
        lumenOrganization: { Component: '/components/admin/account/OrganizationView#OrganizationView', path: '/organization', exact: true },
        lumenNotifications: {
          Component: '/components/admin/account/NotificationsView#NotificationsView',
          path: '/organization/notifications',
          exact: true,
        },
        lumenBilling: { Component: '/components/admin/account/BillingView#BillingView', path: '/organization/billing', exact: true },
      },
    },
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
  ],
  endpoints: lmsEndpoints,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  graphQL: { disablePlaygroundInProduction: true },
  telemetry: false,
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

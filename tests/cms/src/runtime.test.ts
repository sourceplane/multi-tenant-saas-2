import { isWorkersRuntime } from '@cms/lib/runtime'

// The CMS reads its database from the HYPERDRIVE_CMS binding only inside the
// deployed Worker; `next build`, the payload CLI and local development use
// DATABASE_URL. Getting this wrong either crashes the build or points the
// Worker at nothing.
// process.env.NODE_ENV is typed read-only; the suite sets it on purpose.
const env = process.env as Record<string, string | undefined>

describe('isWorkersRuntime', () => {
  const saved = { NODE_ENV: env.NODE_ENV, NEXT_PHASE: env.NEXT_PHASE }
  const argv = [...process.argv]
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete env[k]
      else env[k] = v
    }
    process.argv = [...argv]
  })

  it('is false outside production', () => {
    env.NODE_ENV = 'development'
    expect(isWorkersRuntime()).toBe(false)
  })

  it('is false during `next build`, including its page-data workers', () => {
    env.NODE_ENV = 'production'
    env.NEXT_PHASE = 'phase-production-build'
    expect(isWorkersRuntime()).toBe(false)
  })

  it('is false for the payload and next CLIs', () => {
    env.NODE_ENV = 'production'
    delete env.NEXT_PHASE
    process.argv = ['/usr/bin/node', '/repo/node_modules/payload/bin.js', 'migrate']
    expect(isWorkersRuntime()).toBe(false)
    process.argv = ['/usr/bin/node', '/repo/node_modules/next/dist/bin/next', 'start']
    expect(isWorkersRuntime()).toBe(false)
  })

  it('is true in a production runtime that is neither', () => {
    env.NODE_ENV = 'production'
    delete env.NEXT_PHASE
    process.argv = ['/bundle/worker.js']
    expect(isWorkersRuntime()).toBe(true)
  })
})

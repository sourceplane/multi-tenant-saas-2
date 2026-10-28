import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The deployable config is rendered from wrangler.template.jsonc by the same
// renderer the pipeline runs (wire-fixture on verify lanes, wire-live with the
// published wiring on deploy lanes).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const app = join(root, 'apps/cms')
const template = readFileSync(join(app, 'wrangler.template.jsonc'), 'utf8')

function stripJsonc(text: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inString) {
      out += ch
      if (ch === '\\') out += text[++i] ?? ''
      else if (ch === '"') inString = false
    } else if (ch === '"') {
      inString = true
      out += ch
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (ch === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1
    } else out += ch
  }
  return out
}

type Env = { vars?: Record<string, string>; hyperdrive?: Array<{ binding: string; id: string }> }
let rendered: Env & {
  name: string
  main: string
  compatibility_date: string
  compatibility_flags: string[]
  assets: { directory: string; binding: string }
  env: Record<string, Env>
}

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'cms-wrangler-'))
  try {
    const out = join(dir, 'wrangler.jsonc')
    execFileSync(process.execPath, [
      join(root, 'tooling/wire/render.mjs'),
      '--template', join(app, 'wrangler.template.jsonc'),
      '--out', out,
      '--map', join(app, 'wiring.fixture.json'),
    ])
    rendered = JSON.parse(stripJsonc(readFileSync(out, 'utf8')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('wrangler config', () => {
  it('commits no resource ids, only wiring tokens', () => {
    expect(template).not.toMatch(/"id":\s*"[0-9a-f]{32}"/)
    expect(template).toContain('@@wiring(cloudflare-hyperdrive-cms/stage:hyperdrive_id)@@')
    expect(template).toContain('@@wiring(cloudflare-hyperdrive-cms/prod:hyperdrive_id)@@')
  })

  it('deploys the OpenNext build: worker and static assets', () => {
    expect(rendered.name).toBe('multi-tenant-saas-2-cms')
    expect(rendered.main).toBe('.open-next/worker.js')
    expect(rendered.assets).toEqual({ directory: '.open-next/assets', binding: 'ASSETS' })
  })

  it('runs with nodejs_compat on a date that populates process.env', () => {
    expect(rendered.compatibility_flags).toContain('nodejs_compat')
    // nodejs_compat_populate_process_env is the default from 2025-04-01;
    // Payload reads PAYLOAD_SECRET and CMS_SETUP_TOKEN from process.env.
    expect(rendered.compatibility_date >= '2025-04-01').toBe(true)
  })

  it.each([
    ['stage', '00000000000000000000000000000011'],
    ['prod', '00000000000000000000000000000013'],
  ])('%s binds HYPERDRIVE_CMS to its own config', (env, id) => {
    expect(rendered.env[env]!.hyperdrive).toEqual([{ binding: 'HYPERDRIVE_CMS', id }])
    expect(rendered.env[env]!.vars).toEqual({ ENVIRONMENT: env })
  })

  it('dev binds no database: it never deploys', () => {
    expect(rendered.env.dev!.hyperdrive).toBeUndefined()
  })

  it('carries no secrets: PAYLOAD_SECRET and CMS_SETUP_TOKEN are Worker secrets', () => {
    expect(template).not.toMatch(/PAYLOAD_SECRET|CMS_SETUP_TOKEN/)
  })
})

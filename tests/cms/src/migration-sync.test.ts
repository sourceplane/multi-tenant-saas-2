import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The CMS's schema reaches the database only through db-migrate. Each Payload
// migration in apps/cms/payload-migrations has exactly one converted
// counterpart in packages/db, byte for byte what the converter produces —
// so nobody can edit the SQL by hand, or change a collection's migration
// without landing its SQL.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const payloadDir = join(root, 'apps/cms/payload-migrations')
const converter = join(root, 'apps/cms/scripts/payload-migration-to-sql.mjs')

const CONVERTED: Record<string, string> = {
  '20261027_203229_cms_payload_core.ts': '200_cms_payload_core',
}

describe('Payload migrations ↔ db-migrate', () => {
  const payloadMigrations = readdirSync(payloadDir).filter((f) => /^\d{8}_\d{6}_.+\.ts$/.test(f))

  it('every Payload migration is converted', () => {
    expect(payloadMigrations.sort()).toEqual(Object.keys(CONVERTED).sort())
  })

  it.each(Object.entries(CONVERTED))('%s → %s matches the converter output', (file, id) => {
    const expected = execFileSync(process.execPath, [converter, join(payloadDir, file)], { encoding: 'utf8' })
    const committed = readFileSync(join(root, 'packages/db/src/migrations', id, 'up.sql'), 'utf8')
    expect(committed).toBe(expected)
  })
})

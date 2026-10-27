#!/usr/bin/env node
// Turns a Payload migration (payload-migrations/<name>.ts, written by
// `payload migrate:create`) into an idempotent up.sql for the db-migrate lane
// (packages/db/src/migrations/<id>/up.sql) — the CMS never
// migrates itself; its DDL lands through the same lane as every other context.
//
//   node scripts/payload-migration-to-sql.mjs payload-migrations/<name>.ts > up.sql
//
// Idempotent because the runner sends a migration as one query to the Supabase
// Management API with no transaction of its own: a partial apply must converge
// on retry. Statements it cannot make idempotent (drops, renames, type
// changes) are kept as written and reported on stderr, and the exit code is 2
// so they cannot slip through unread.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const file = process.argv[2]
if (!file) {
  console.error('usage: payload-migration-to-sql.mjs <payload-migration.ts>')
  process.exit(1)
}
const source = readFileSync(file, 'utf8')
const upStart = source.indexOf('export async function up')
const downStart = source.indexOf('export async function down')
const up = source.slice(upStart, downStart === -1 ? undefined : downStart)
const open = up.indexOf('sql`')
const close = up.lastIndexOf('`)')
if (upStart === -1 || open === -1 || close === -1) {
  console.error(`${file}: no sql\`…\` block in up()`)
  process.exit(1)
}

const statements = up
  .slice(open + 4, close)
  .split(/;\s*\n/)
  .map((s) => s.trim().replace(/;$/, ''))
  .filter(Boolean)

const guarded = (stmt) => `DO $$ BEGIN\n  ${stmt};\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;`
const unsafe = []
const out = statements.map((stmt) => {
  if (/^CREATE TYPE /.test(stmt)) return guarded(stmt)
  if (/^CREATE TABLE /.test(stmt)) return stmt.replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ') + ';'
  if (/^CREATE (UNIQUE )?INDEX "/.test(stmt)) return stmt.replace(/^CREATE (UNIQUE )?INDEX "/, 'CREATE $1INDEX IF NOT EXISTS "') + ';'
  if (/^ALTER TABLE \S+ ADD CONSTRAINT /.test(stmt)) return guarded(stmt)
  if (/^ALTER TABLE \S+ ADD COLUMN "/.test(stmt)) return stmt.replace(/ ADD COLUMN "/, ' ADD COLUMN IF NOT EXISTS "') + ';'
  if (/^ALTER TYPE \S+ ADD VALUE '/.test(stmt)) return stmt.replace(/ ADD VALUE '/, " ADD VALUE IF NOT EXISTS '") + ';'
  unsafe.push(stmt.split('\n')[0])
  return stmt + ';'
})

const header = [
  `-- Generated from apps/cms/payload-migrations/${basename(file)}`,
  '-- by apps/cms/scripts/payload-migration-to-sql.mjs. Do not edit by hand:',
  '-- change the collection, run `payload migrate:create`, and convert again.',
  '',
  'CREATE SCHEMA IF NOT EXISTS cms;',
  '',
]
process.stdout.write(header.join('\n') + out.join('\n') + '\n')
if (unsafe.length) {
  console.error(`${unsafe.length} statement(s) kept as written — review before landing:`)
  for (const s of unsafe) console.error(`  ${s}`)
  process.exit(2)
}

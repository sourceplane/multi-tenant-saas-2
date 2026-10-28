import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { manifest, BOUNDED_CONTEXTS } from "@saas/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_ROOT = resolve(
  __dirname,
  "../../..",
  "packages/db/src/migrations",
);

// 200_cms_payload_core is generated from Payload's own migration by
// apps/cms/scripts/payload-migration-to-sql.mjs. The runner applies it through
// the Supabase Management API in autocommit, so a partial apply must converge
// on retry: every statement has to be safe to run twice.
const sql = readFileSync(
  resolve(MIGRATIONS_ROOT, "200_cms_payload_core/up.sql"),
  "utf-8",
);

// Split on statement ends outside DO $$ … $$ blocks.
function statements(text: string): string[] {
  const out: string[] = [];
  let current = "";
  let inDollar = false;
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("--") && !inDollar) continue;
    current += line + "\n";
    const dollars = (line.match(/\$\$/g) ?? []).length;
    if (dollars % 2 === 1) inDollar = !inDollar;
    if (!inDollar && line.trim().endsWith(";")) {
      if (current.trim()) out.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

describe("CMS migration (200_cms_payload_core)", () => {
  const entry = manifest.migrations.find((m) => m.id === "200_cms_payload_core");

  it("registers 'cms' as a bounded context", () => {
    expect(BOUNDED_CONTEXTS).toContain("cms");
  });

  it("is in the manifest under the cms context", () => {
    expect(entry).toBeDefined();
    expect(entry!.context).toBe("cms");
  });

  it("creates the cms schema first", () => {
    expect(statements(sql)[0]).toBe("CREATE SCHEMA IF NOT EXISTS cms;");
  });

  it("creates every table Payload's configuration reads", () => {
    for (const table of [
      "users",
      "users_sessions",
      "pages",
      "_pages_v",
      "posts",
      "_posts_v",
      "categories",
      "payload_locked_documents",
      "payload_locked_documents_rels",
      "payload_preferences",
      "payload_preferences_rels",
      "payload_migrations",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "cms"."${table}" (`);
    }
  });

  it("only touches schema cms", () => {
    // Every object it creates, alters or references is "cms"."<name>".
    const targets = [
      ...sql.matchAll(/(?:CREATE TABLE IF NOT EXISTS|CREATE TYPE|ALTER TABLE|REFERENCES|ON) ("[a-z_]+")\./g),
    ].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(20);
    expect(new Set(targets)).toEqual(new Set(['"cms"']));
    expect(sql).not.toMatch(/\b(public|identity|membership|billing|events|projects)\./);
  });

  it("is idempotent statement by statement", () => {
    for (const stmt of statements(sql)) {
      const ok =
        stmt.startsWith("CREATE SCHEMA IF NOT EXISTS ") ||
        stmt.startsWith("CREATE TABLE IF NOT EXISTS ") ||
        /^CREATE (UNIQUE )?INDEX IF NOT EXISTS /.test(stmt) ||
        /^DO \$\$ BEGIN\n\s+(CREATE TYPE|ALTER TABLE \S+ ADD CONSTRAINT) [\s\S]*EXCEPTION WHEN duplicate_object THEN NULL;\nEND \$\$;$/.test(stmt);
      if (!ok) throw new Error(`not idempotent: ${stmt.split("\n")[0]}`);
    }
  });

  it("drops, grants and renames nothing", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bGRANT\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
  });

  it("keys every document by uuid (idType: 'uuid')", () => {
    for (const table of ["users", "pages", "posts", "categories"]) {
      const create = statements(sql).find((s) =>
        s.startsWith(`CREATE TABLE IF NOT EXISTS "cms"."${table}" (`),
      );
      expect(create).toMatch(/"id" uuid PRIMARY KEY/);
    }
  });
});

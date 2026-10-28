import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { manifest } from "@saas/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_ROOT = resolve(
  __dirname,
  "../../..",
  "packages/db/src/migrations",
);

// The learning domain's migrations (multi-tenant-saas-2-lms). Like 200, the
// runner applies them through the Supabase Management API in autocommit, so
// every statement must be safe to run twice.
const read = (id: string) =>
  readFileSync(resolve(MIGRATIONS_ROOT, `${id}/up.sql`), "utf-8");

function statements(text: string): string[] {
  const out: string[] = [];
  let current = "";
  let inDollar = false;
  for (const line of text.split("\n")) {
    if (!inDollar && (line.trim().startsWith("--") || line.trim() === "")) continue;
    current += line + "\n";
    if (((line.match(/\$\$/g) ?? []).length) % 2 === 1) inDollar = !inDollar;
    if (!inDollar && line.trim().endsWith(";")) {
      out.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const GUARDED_DO =
  /^DO \$\$ BEGIN\n\s+(CREATE TYPE|ALTER TABLE \S+ ADD CONSTRAINT) [\s\S]*EXCEPTION WHEN duplicate_object THEN NULL;\nEND \$\$;$/;

describe("LMS migrations", () => {
  it("are registered in order under the cms context, after the CMS core", () => {
    const ids = manifest.migrations.map((m) => m.id);
    const at200 = ids.indexOf("200_cms_payload_core");
    expect(ids.indexOf("300_lms_course_model")).toBeGreaterThan(at200);
    expect(ids.indexOf("301_lms_sample_academy")).toBe(ids.indexOf("300_lms_course_model") + 1);
    for (const id of ["300_lms_course_model", "301_lms_sample_academy"]) {
      expect(manifest.migrations.find((m) => m.id === id)!.context).toBe("cms");
    }
  });

  describe("300_lms_course_model (generated)", () => {
    const sql = read("300_lms_course_model");

    it("creates the course model's tables in schema cms", () => {
      for (const table of [
        "tenants",
        "courses",
        "_courses_v",
        "lessons",
        "quizzes",
        "quizzes_questions",
        "quizzes_questions_options",
        "users_rels",
      ]) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "cms"."${table}" (`);
      }
    });

    it("adds the instructor role without rewriting the enum", () => {
      expect(sql).toContain(
        `ALTER TYPE "cms"."enum_users_role" ADD VALUE IF NOT EXISTS 'instructor';`,
      );
    });

    it("keeps course slugs unique per academy and lesson/quiz slugs unique per course", () => {
      expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "\w+" ON "cms"\."courses" USING btree \("tenant_id","slug"\)/);
      expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "\w+" ON "cms"\."lessons" USING btree \("course_id","slug"\)/);
      expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "\w+" ON "cms"\."quizzes" USING btree \("course_id","slug"\)/);
    });

    it("is idempotent statement by statement", () => {
      for (const stmt of statements(sql)) {
        const ok =
          stmt.startsWith("CREATE SCHEMA IF NOT EXISTS ") ||
          stmt.startsWith("CREATE TABLE IF NOT EXISTS ") ||
          /^CREATE (UNIQUE )?INDEX IF NOT EXISTS /.test(stmt) ||
          /^ALTER TABLE "cms"\."\w+" ADD COLUMN IF NOT EXISTS /.test(stmt) ||
          /^ALTER TYPE "cms"\."\w+" ADD VALUE IF NOT EXISTS /.test(stmt) ||
          GUARDED_DO.test(stmt);
        if (!ok) throw new Error(`not idempotent: ${stmt.split("\n")[0]}`);
      }
    });

    it("drops, grants and renames nothing, and stays in schema cms", () => {
      expect(sql).not.toMatch(/\b(DROP|GRANT|RENAME)\b/i);
      expect(sql).not.toMatch(/\b(public|identity|membership|billing|events|projects)\./);
    });
  });

  describe("310_lms_learner_records (generated)", () => {
    const sql = read("310_lms_learner_records");

    it("is registered after the sample academy", () => {
      const ids = manifest.migrations.map((m) => m.id);
      expect(ids.indexOf("310_lms_learner_records")).toBeGreaterThan(ids.indexOf("301_lms_sample_academy"));
    });

    it("creates the learner tables in schema cms", () => {
      for (const table of ["learners", "learners_sessions", "enrolments", "lesson_progress", "quiz_attempts", "certificates"]) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "cms"."${table}" (`);
      }
    });

    it("lets the database refuse duplicates: one enrolment, progress row and certificate each", () => {
      expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "\w+" ON "cms"\."enrolments" USING btree \("learner_id","course_id"\)/);
      expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "\w+" ON "cms"\."lesson_progress" USING btree \("learner_id","lesson_id"\)/);
      expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "\w+" ON "cms"\."certificates" USING btree \("learner_id","course_id"\)/);
      expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "\w+" ON "cms"\."certificates" USING btree \("serial"\)/);
      expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "\w+" ON "cms"\."learners" USING btree \("email"\)/);
    });

    it("is idempotent statement by statement, and stays in schema cms", () => {
      for (const stmt of statements(sql)) {
        const ok =
          stmt.startsWith("CREATE SCHEMA IF NOT EXISTS ") ||
          stmt.startsWith("CREATE TABLE IF NOT EXISTS ") ||
          /^CREATE (UNIQUE )?INDEX IF NOT EXISTS /.test(stmt) ||
          /^ALTER TABLE "cms"\."\w+" ADD COLUMN IF NOT EXISTS /.test(stmt) ||
          /^ALTER TYPE "cms"\."\w+" ADD VALUE IF NOT EXISTS /.test(stmt) ||
          GUARDED_DO.test(stmt);
        if (!ok) throw new Error(`not idempotent: ${stmt.split("\n")[0]}`);
      }
      expect(sql).not.toMatch(/\b(DROP|GRANT|RENAME)\b/i);
      expect(sql).not.toMatch(/\b(public|identity|membership|billing|events|projects)\./);
    });
  });

  describe("301_lms_sample_academy (seed)", () => {
    const sql = read("301_lms_sample_academy");
    const stmts = statements(sql);

    it("only inserts, into schema cms, and never overwrites", () => {
      expect(stmts.length).toBeGreaterThan(0);
      for (const stmt of stmts) {
        expect(stmt).toMatch(/^INSERT INTO cms\.\w+ \(/);
        expect(stmt.endsWith("ON CONFLICT DO NOTHING;")).toBe(true);
      }
    });

    it("inserts each child row only when its parent exists", () => {
      for (const stmt of stmts.filter((s) => !s.startsWith("INSERT INTO cms.tenants "))) {
        expect(stmt).toMatch(/WHERE EXISTS \(SELECT 1 FROM cms\.\w+ WHERE id = '[^']+'\)/);
      }
    });

    it("seeds one published course with three lessons and one quiz", () => {
      expect(stmts.filter((s) => s.startsWith("INSERT INTO cms.tenants "))).toHaveLength(1);
      expect(stmts.filter((s) => s.startsWith("INSERT INTO cms.courses "))).toHaveLength(1);
      expect(stmts.filter((s) => s.startsWith("INSERT INTO cms.lessons "))).toHaveLength(3);
      expect(stmts.filter((s) => s.startsWith("INSERT INTO cms.quizzes "))).toHaveLength(1);
      expect(sql).toContain("'getting-started', ");
      expect(sql).toMatch(/'beginner', 'published'/);
    });

    it("gives every quiz question an answer that is one of its options", () => {
      const questions = [...sql.matchAll(/INSERT INTO cms\.quizzes_questions \(_order, _parent_id, id, prompt, correct_index\)\nSELECT \d+, '[^']+', '([^']+)', '(?:[^']|'')+', (\d+)/g)];
      expect(questions).toHaveLength(3);
      for (const [, id, correct] of questions) {
        const options = [...sql.matchAll(new RegExp(`quizzes_questions_options \\(_order, _parent_id, id, label\\)\\nSELECT \\d+, '${id}'`, "g"))];
        expect(options.length).toBeGreaterThanOrEqual(2);
        expect(Number(correct)).toBeLessThan(options.length);
      }
    });
  });
});

-- Generated from apps/cms/payload-migrations/20261027_213624_lms_course_model.ts
-- by apps/cms/scripts/payload-migration-to-sql.mjs. Do not edit by hand:
-- change the collection, run `payload migrate:create`, and convert again.

CREATE SCHEMA IF NOT EXISTS cms;
DO $$ BEGIN
  CREATE TYPE "cms"."enum_tenants_enrolment" AS ENUM('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "cms"."enum_courses_level" AS ENUM('beginner', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "cms"."enum_courses_status" AS ENUM('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "cms"."enum__courses_v_version_level" AS ENUM('beginner', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "cms"."enum__courses_v_version_status" AS ENUM('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TYPE "cms"."enum_users_role" ADD VALUE IF NOT EXISTS 'instructor';
CREATE TABLE IF NOT EXISTS "cms"."users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"tenants_id" uuid
  );
CREATE TABLE IF NOT EXISTS "cms"."tenants" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"enrolment" "cms"."enum_tenants_enrolment" DEFAULT 'open' NOT NULL,
  	"lumen_org_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
CREATE TABLE IF NOT EXISTS "cms"."courses" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid,
  	"title" varchar,
  	"slug" varchar,
  	"summary" varchar,
  	"level" "cms"."enum_courses_level" DEFAULT 'beginner',
  	"cover_url" varchar,
  	"instructor_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_courses_status" DEFAULT 'draft'
  );
CREATE TABLE IF NOT EXISTS "cms"."_courses_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_tenant_id" uuid,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_summary" varchar,
  	"version_level" "cms"."enum__courses_v_version_level" DEFAULT 'beginner',
  	"version_cover_url" varchar,
  	"version_instructor_id" uuid,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__courses_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
CREATE TABLE IF NOT EXISTS "cms"."lessons" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"course_id" uuid NOT NULL,
  	"tenant_id" uuid,
  	"order" numeric DEFAULT 1 NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"minutes" numeric,
  	"video_url" varchar,
  	"content" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
CREATE TABLE IF NOT EXISTS "cms"."quizzes_questions_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
CREATE TABLE IF NOT EXISTS "cms"."quizzes_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prompt" varchar NOT NULL,
  	"correct_index" numeric NOT NULL
  );
CREATE TABLE IF NOT EXISTS "cms"."quizzes" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"course_id" uuid NOT NULL,
  	"tenant_id" uuid,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"passing_score" numeric DEFAULT 70 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tenants_id" uuid;
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "courses_id" uuid;
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "lessons_id" uuid;
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "quizzes_id" uuid;
DO $$ BEGIN
  ALTER TABLE "cms"."users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."users_rels" ADD CONSTRAINT "users_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "cms"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."courses" ADD CONSTRAINT "courses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."courses" ADD CONSTRAINT "courses_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."_courses_v" ADD CONSTRAINT "_courses_v_parent_id_courses_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."_courses_v" ADD CONSTRAINT "_courses_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."_courses_v" ADD CONSTRAINT "_courses_v_version_instructor_id_users_id_fk" FOREIGN KEY ("version_instructor_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."lessons" ADD CONSTRAINT "lessons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."quizzes_questions_options" ADD CONSTRAINT "quizzes_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."quizzes_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."quizzes_questions" ADD CONSTRAINT "quizzes_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."quizzes" ADD CONSTRAINT "quizzes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "users_rels_order_idx" ON "cms"."users_rels" USING btree ("order");
CREATE INDEX IF NOT EXISTS "users_rels_parent_idx" ON "cms"."users_rels" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "users_rels_path_idx" ON "cms"."users_rels" USING btree ("path");
CREATE INDEX IF NOT EXISTS "users_rels_tenants_id_idx" ON "cms"."users_rels" USING btree ("tenants_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_idx" ON "cms"."tenants" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "tenants_updated_at_idx" ON "cms"."tenants" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "tenants_created_at_idx" ON "cms"."tenants" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "courses_tenant_idx" ON "cms"."courses" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "courses_slug_idx" ON "cms"."courses" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "courses_instructor_idx" ON "cms"."courses" USING btree ("instructor_id");
CREATE INDEX IF NOT EXISTS "courses_updated_at_idx" ON "cms"."courses" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "courses_created_at_idx" ON "cms"."courses" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "courses__status_idx" ON "cms"."courses" USING btree ("_status");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_slug_idx" ON "cms"."courses" USING btree ("tenant_id","slug");
CREATE INDEX IF NOT EXISTS "_courses_v_parent_idx" ON "cms"."_courses_v" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "_courses_v_version_version_tenant_idx" ON "cms"."_courses_v" USING btree ("version_tenant_id");
CREATE INDEX IF NOT EXISTS "_courses_v_version_version_slug_idx" ON "cms"."_courses_v" USING btree ("version_slug");
CREATE INDEX IF NOT EXISTS "_courses_v_version_version_instructor_idx" ON "cms"."_courses_v" USING btree ("version_instructor_id");
CREATE INDEX IF NOT EXISTS "_courses_v_version_version_updated_at_idx" ON "cms"."_courses_v" USING btree ("version_updated_at");
CREATE INDEX IF NOT EXISTS "_courses_v_version_version_created_at_idx" ON "cms"."_courses_v" USING btree ("version_created_at");
CREATE INDEX IF NOT EXISTS "_courses_v_version_version__status_idx" ON "cms"."_courses_v" USING btree ("version__status");
CREATE INDEX IF NOT EXISTS "_courses_v_created_at_idx" ON "cms"."_courses_v" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "_courses_v_updated_at_idx" ON "cms"."_courses_v" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "_courses_v_latest_idx" ON "cms"."_courses_v" USING btree ("latest");
CREATE INDEX IF NOT EXISTS "version_tenant_version_slug_idx" ON "cms"."_courses_v" USING btree ("version_tenant_id","version_slug");
CREATE INDEX IF NOT EXISTS "lessons_course_idx" ON "cms"."lessons" USING btree ("course_id");
CREATE INDEX IF NOT EXISTS "lessons_tenant_idx" ON "cms"."lessons" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "lessons_slug_idx" ON "cms"."lessons" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "lessons_updated_at_idx" ON "cms"."lessons" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "lessons_created_at_idx" ON "cms"."lessons" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "course_slug_idx" ON "cms"."lessons" USING btree ("course_id","slug");
CREATE INDEX IF NOT EXISTS "quizzes_questions_options_order_idx" ON "cms"."quizzes_questions_options" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "quizzes_questions_options_parent_id_idx" ON "cms"."quizzes_questions_options" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "quizzes_questions_order_idx" ON "cms"."quizzes_questions" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "quizzes_questions_parent_id_idx" ON "cms"."quizzes_questions" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "quizzes_course_idx" ON "cms"."quizzes" USING btree ("course_id");
CREATE INDEX IF NOT EXISTS "quizzes_tenant_idx" ON "cms"."quizzes" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "quizzes_slug_idx" ON "cms"."quizzes" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "quizzes_updated_at_idx" ON "cms"."quizzes" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "quizzes_created_at_idx" ON "cms"."quizzes" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "course_slug_1_idx" ON "cms"."quizzes" USING btree ("course_id","slug");
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "cms"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "cms"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lessons_fk" FOREIGN KEY ("lessons_id") REFERENCES "cms"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quizzes_fk" FOREIGN KEY ("quizzes_id") REFERENCES "cms"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tenants_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("tenants_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_courses_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("courses_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_lessons_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("lessons_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_quizzes_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("quizzes_id");

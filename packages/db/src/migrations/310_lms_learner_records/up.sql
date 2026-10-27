-- Generated from apps/cms/payload-migrations/20261027_214746_lms_learner_records.ts
-- by apps/cms/scripts/payload-migration-to-sql.mjs. Do not edit by hand:
-- change the collection, run `payload migrate:create`, and convert again.

CREATE SCHEMA IF NOT EXISTS cms;
DO $$ BEGIN
  CREATE TYPE "cms"."enum_enrolments_status" AS ENUM('active', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "cms"."learners_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
CREATE TABLE IF NOT EXISTS "cms"."learners" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
CREATE TABLE IF NOT EXISTS "cms"."enrolments" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid NOT NULL,
  	"learner_id" uuid NOT NULL,
  	"course_id" uuid NOT NULL,
  	"status" "cms"."enum_enrolments_status" DEFAULT 'active' NOT NULL,
  	"enrolled_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone,
  	"last_activity_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
CREATE TABLE IF NOT EXISTS "cms"."lesson_progress" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid NOT NULL,
  	"learner_id" uuid NOT NULL,
  	"course_id" uuid NOT NULL,
  	"lesson_id" uuid NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
CREATE TABLE IF NOT EXISTS "cms"."quiz_attempts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid NOT NULL,
  	"learner_id" uuid NOT NULL,
  	"course_id" uuid NOT NULL,
  	"quiz_id" uuid NOT NULL,
  	"score" numeric NOT NULL,
  	"passed" boolean DEFAULT false NOT NULL,
  	"answers" jsonb NOT NULL,
  	"submitted_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
CREATE TABLE IF NOT EXISTS "cms"."certificates" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid NOT NULL,
  	"learner_id" uuid NOT NULL,
  	"course_id" uuid NOT NULL,
  	"serial" varchar NOT NULL,
  	"issued_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "learners_id" uuid;
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "enrolments_id" uuid;
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "lesson_progress_id" uuid;
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "quiz_attempts_id" uuid;
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "certificates_id" uuid;
ALTER TABLE "cms"."payload_preferences_rels" ADD COLUMN IF NOT EXISTS "learners_id" uuid;
DO $$ BEGIN
  ALTER TABLE "cms"."learners_sessions" ADD CONSTRAINT "learners_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."learners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."enrolments" ADD CONSTRAINT "enrolments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."enrolments" ADD CONSTRAINT "enrolments_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "cms"."learners"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."enrolments" ADD CONSTRAINT "enrolments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."lesson_progress" ADD CONSTRAINT "lesson_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."lesson_progress" ADD CONSTRAINT "lesson_progress_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "cms"."learners"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."lesson_progress" ADD CONSTRAINT "lesson_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "cms"."lessons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "cms"."learners"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "cms"."quizzes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."certificates" ADD CONSTRAINT "certificates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."certificates" ADD CONSTRAINT "certificates_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "cms"."learners"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "learners_sessions_order_idx" ON "cms"."learners_sessions" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "learners_sessions_parent_id_idx" ON "cms"."learners_sessions" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "learners_updated_at_idx" ON "cms"."learners" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "learners_created_at_idx" ON "cms"."learners" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "learners_email_idx" ON "cms"."learners" USING btree ("email");
CREATE INDEX IF NOT EXISTS "enrolments_tenant_idx" ON "cms"."enrolments" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "enrolments_learner_idx" ON "cms"."enrolments" USING btree ("learner_id");
CREATE INDEX IF NOT EXISTS "enrolments_course_idx" ON "cms"."enrolments" USING btree ("course_id");
CREATE INDEX IF NOT EXISTS "enrolments_updated_at_idx" ON "cms"."enrolments" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "enrolments_created_at_idx" ON "cms"."enrolments" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "learner_course_idx" ON "cms"."enrolments" USING btree ("learner_id","course_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_tenant_idx" ON "cms"."lesson_progress" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_learner_idx" ON "cms"."lesson_progress" USING btree ("learner_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_course_idx" ON "cms"."lesson_progress" USING btree ("course_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_lesson_idx" ON "cms"."lesson_progress" USING btree ("lesson_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_updated_at_idx" ON "cms"."lesson_progress" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "lesson_progress_created_at_idx" ON "cms"."lesson_progress" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "learner_lesson_idx" ON "cms"."lesson_progress" USING btree ("learner_id","lesson_id");
CREATE INDEX IF NOT EXISTS "quiz_attempts_tenant_idx" ON "cms"."quiz_attempts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "quiz_attempts_learner_idx" ON "cms"."quiz_attempts" USING btree ("learner_id");
CREATE INDEX IF NOT EXISTS "quiz_attempts_course_idx" ON "cms"."quiz_attempts" USING btree ("course_id");
CREATE INDEX IF NOT EXISTS "quiz_attempts_quiz_idx" ON "cms"."quiz_attempts" USING btree ("quiz_id");
CREATE INDEX IF NOT EXISTS "quiz_attempts_passed_idx" ON "cms"."quiz_attempts" USING btree ("passed");
CREATE INDEX IF NOT EXISTS "quiz_attempts_updated_at_idx" ON "cms"."quiz_attempts" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "quiz_attempts_created_at_idx" ON "cms"."quiz_attempts" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "certificates_tenant_idx" ON "cms"."certificates" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "certificates_learner_idx" ON "cms"."certificates" USING btree ("learner_id");
CREATE INDEX IF NOT EXISTS "certificates_course_idx" ON "cms"."certificates" USING btree ("course_id");
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_serial_idx" ON "cms"."certificates" USING btree ("serial");
CREATE INDEX IF NOT EXISTS "certificates_updated_at_idx" ON "cms"."certificates" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "certificates_created_at_idx" ON "cms"."certificates" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "learner_course_1_idx" ON "cms"."certificates" USING btree ("learner_id","course_id");
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_learners_fk" FOREIGN KEY ("learners_id") REFERENCES "cms"."learners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrolments_fk" FOREIGN KEY ("enrolments_id") REFERENCES "cms"."enrolments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lesson_progress_fk" FOREIGN KEY ("lesson_progress_id") REFERENCES "cms"."lesson_progress"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quiz_attempts_fk" FOREIGN KEY ("quiz_attempts_id") REFERENCES "cms"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_certificates_fk" FOREIGN KEY ("certificates_id") REFERENCES "cms"."certificates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_learners_fk" FOREIGN KEY ("learners_id") REFERENCES "cms"."learners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_learners_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("learners_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_enrolments_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("enrolments_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_lesson_progress_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("lesson_progress_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_quiz_attempts_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("quiz_attempts_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_certificates_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("certificates_id");
CREATE INDEX IF NOT EXISTS "payload_preferences_rels_learners_id_idx" ON "cms"."payload_preferences_rels" USING btree ("learners_id");

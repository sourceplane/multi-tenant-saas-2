import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_tenants_enrolment" AS ENUM('open', 'closed');
  CREATE TYPE "cms"."enum_courses_level" AS ENUM('beginner', 'intermediate', 'advanced');
  CREATE TYPE "cms"."enum_courses_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__courses_v_version_level" AS ENUM('beginner', 'intermediate', 'advanced');
  CREATE TYPE "cms"."enum__courses_v_version_status" AS ENUM('draft', 'published');
  ALTER TYPE "cms"."enum_users_role" ADD VALUE 'instructor';
  CREATE TABLE "cms"."users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"tenants_id" uuid
  );
  
  CREATE TABLE "cms"."tenants" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"enrolment" "cms"."enum_tenants_enrolment" DEFAULT 'open' NOT NULL,
  	"lumen_org_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."courses" (
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
  
  CREATE TABLE "cms"."_courses_v" (
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
  
  CREATE TABLE "cms"."lessons" (
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
  
  CREATE TABLE "cms"."quizzes_questions_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."quizzes_questions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prompt" varchar NOT NULL,
  	"correct_index" numeric NOT NULL
  );
  
  CREATE TABLE "cms"."quizzes" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"course_id" uuid NOT NULL,
  	"tenant_id" uuid,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"passing_score" numeric DEFAULT 70 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "tenants_id" uuid;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "courses_id" uuid;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "lessons_id" uuid;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "quizzes_id" uuid;
  ALTER TABLE "cms"."users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."users_rels" ADD CONSTRAINT "users_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "cms"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."courses" ADD CONSTRAINT "courses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."courses" ADD CONSTRAINT "courses_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_courses_v" ADD CONSTRAINT "_courses_v_parent_id_courses_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_courses_v" ADD CONSTRAINT "_courses_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_courses_v" ADD CONSTRAINT "_courses_v_version_instructor_id_users_id_fk" FOREIGN KEY ("version_instructor_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."lessons" ADD CONSTRAINT "lessons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."quizzes_questions_options" ADD CONSTRAINT "quizzes_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."quizzes_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."quizzes_questions" ADD CONSTRAINT "quizzes_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "cms"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."quizzes" ADD CONSTRAINT "quizzes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_rels_order_idx" ON "cms"."users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "cms"."users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "cms"."users_rels" USING btree ("path");
  CREATE INDEX "users_rels_tenants_id_idx" ON "cms"."users_rels" USING btree ("tenants_id");
  CREATE UNIQUE INDEX "tenants_slug_idx" ON "cms"."tenants" USING btree ("slug");
  CREATE INDEX "tenants_updated_at_idx" ON "cms"."tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "cms"."tenants" USING btree ("created_at");
  CREATE INDEX "courses_tenant_idx" ON "cms"."courses" USING btree ("tenant_id");
  CREATE INDEX "courses_slug_idx" ON "cms"."courses" USING btree ("slug");
  CREATE INDEX "courses_instructor_idx" ON "cms"."courses" USING btree ("instructor_id");
  CREATE INDEX "courses_updated_at_idx" ON "cms"."courses" USING btree ("updated_at");
  CREATE INDEX "courses_created_at_idx" ON "cms"."courses" USING btree ("created_at");
  CREATE INDEX "courses__status_idx" ON "cms"."courses" USING btree ("_status");
  CREATE UNIQUE INDEX "tenant_slug_idx" ON "cms"."courses" USING btree ("tenant_id","slug");
  CREATE INDEX "_courses_v_parent_idx" ON "cms"."_courses_v" USING btree ("parent_id");
  CREATE INDEX "_courses_v_version_version_tenant_idx" ON "cms"."_courses_v" USING btree ("version_tenant_id");
  CREATE INDEX "_courses_v_version_version_slug_idx" ON "cms"."_courses_v" USING btree ("version_slug");
  CREATE INDEX "_courses_v_version_version_instructor_idx" ON "cms"."_courses_v" USING btree ("version_instructor_id");
  CREATE INDEX "_courses_v_version_version_updated_at_idx" ON "cms"."_courses_v" USING btree ("version_updated_at");
  CREATE INDEX "_courses_v_version_version_created_at_idx" ON "cms"."_courses_v" USING btree ("version_created_at");
  CREATE INDEX "_courses_v_version_version__status_idx" ON "cms"."_courses_v" USING btree ("version__status");
  CREATE INDEX "_courses_v_created_at_idx" ON "cms"."_courses_v" USING btree ("created_at");
  CREATE INDEX "_courses_v_updated_at_idx" ON "cms"."_courses_v" USING btree ("updated_at");
  CREATE INDEX "_courses_v_latest_idx" ON "cms"."_courses_v" USING btree ("latest");
  CREATE INDEX "version_tenant_version_slug_idx" ON "cms"."_courses_v" USING btree ("version_tenant_id","version_slug");
  CREATE INDEX "lessons_course_idx" ON "cms"."lessons" USING btree ("course_id");
  CREATE INDEX "lessons_tenant_idx" ON "cms"."lessons" USING btree ("tenant_id");
  CREATE INDEX "lessons_slug_idx" ON "cms"."lessons" USING btree ("slug");
  CREATE INDEX "lessons_updated_at_idx" ON "cms"."lessons" USING btree ("updated_at");
  CREATE INDEX "lessons_created_at_idx" ON "cms"."lessons" USING btree ("created_at");
  CREATE UNIQUE INDEX "course_slug_idx" ON "cms"."lessons" USING btree ("course_id","slug");
  CREATE INDEX "quizzes_questions_options_order_idx" ON "cms"."quizzes_questions_options" USING btree ("_order");
  CREATE INDEX "quizzes_questions_options_parent_id_idx" ON "cms"."quizzes_questions_options" USING btree ("_parent_id");
  CREATE INDEX "quizzes_questions_order_idx" ON "cms"."quizzes_questions" USING btree ("_order");
  CREATE INDEX "quizzes_questions_parent_id_idx" ON "cms"."quizzes_questions" USING btree ("_parent_id");
  CREATE INDEX "quizzes_course_idx" ON "cms"."quizzes" USING btree ("course_id");
  CREATE INDEX "quizzes_tenant_idx" ON "cms"."quizzes" USING btree ("tenant_id");
  CREATE INDEX "quizzes_slug_idx" ON "cms"."quizzes" USING btree ("slug");
  CREATE INDEX "quizzes_updated_at_idx" ON "cms"."quizzes" USING btree ("updated_at");
  CREATE INDEX "quizzes_created_at_idx" ON "cms"."quizzes" USING btree ("created_at");
  CREATE UNIQUE INDEX "course_slug_1_idx" ON "cms"."quizzes" USING btree ("course_id","slug");
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "cms"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "cms"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lessons_fk" FOREIGN KEY ("lessons_id") REFERENCES "cms"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quizzes_fk" FOREIGN KEY ("quizzes_id") REFERENCES "cms"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_courses_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("courses_id");
  CREATE INDEX "payload_locked_documents_rels_lessons_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("lessons_id");
  CREATE INDEX "payload_locked_documents_rels_quizzes_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("quizzes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."users_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."tenants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."courses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_courses_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."lessons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."quizzes_questions_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."quizzes_questions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."quizzes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."users_rels" CASCADE;
  DROP TABLE "cms"."tenants" CASCADE;
  DROP TABLE "cms"."courses" CASCADE;
  DROP TABLE "cms"."_courses_v" CASCADE;
  DROP TABLE "cms"."lessons" CASCADE;
  DROP TABLE "cms"."quizzes_questions_options" CASCADE;
  DROP TABLE "cms"."quizzes_questions" CASCADE;
  DROP TABLE "cms"."quizzes" CASCADE;
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tenants_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_courses_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lessons_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quizzes_fk";
  
  ALTER TABLE "cms"."users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "cms"."users" ALTER COLUMN "role" SET DEFAULT 'editor'::text;
  DROP TYPE "cms"."enum_users_role";
  CREATE TYPE "cms"."enum_users_role" AS ENUM('admin', 'editor');
  ALTER TABLE "cms"."users" ALTER COLUMN "role" SET DEFAULT 'editor'::"cms"."enum_users_role";
  ALTER TABLE "cms"."users" ALTER COLUMN "role" SET DATA TYPE "cms"."enum_users_role" USING "role"::"cms"."enum_users_role";
  DROP INDEX "cms"."payload_locked_documents_rels_tenants_id_idx";
  DROP INDEX "cms"."payload_locked_documents_rels_courses_id_idx";
  DROP INDEX "cms"."payload_locked_documents_rels_lessons_id_idx";
  DROP INDEX "cms"."payload_locked_documents_rels_quizzes_id_idx";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "tenants_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "courses_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "lessons_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "quizzes_id";
  DROP TYPE "cms"."enum_tenants_enrolment";
  DROP TYPE "cms"."enum_courses_level";
  DROP TYPE "cms"."enum_courses_status";
  DROP TYPE "cms"."enum__courses_v_version_level";
  DROP TYPE "cms"."enum__courses_v_version_status";`)
}

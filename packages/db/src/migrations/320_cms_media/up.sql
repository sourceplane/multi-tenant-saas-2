-- Generated from apps/cms/payload-migrations/20261028_101104_cms_media.ts
-- by apps/cms/scripts/payload-migration-to-sql.mjs. Do not edit by hand:
-- change the collection, run `payload migrate:create`, and convert again.

CREATE SCHEMA IF NOT EXISTS cms;
CREATE TABLE IF NOT EXISTS "cms"."media" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"alt" varchar NOT NULL,
  	"tenant_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric
  );
ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "media_id" uuid;
DO $$ BEGIN
  ALTER TABLE "cms"."media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "media_tenant_idx" ON "cms"."media" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "media_updated_at_idx" ON "cms"."media" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "media_created_at_idx" ON "cms"."media" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "media_filename_idx" ON "cms"."media" USING btree ("filename");
DO $$ BEGIN
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_media_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("media_id");

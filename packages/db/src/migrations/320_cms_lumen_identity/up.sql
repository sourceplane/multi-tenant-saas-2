-- Generated from apps/cms/payload-migrations/20261028_213731_cms_lumen_identity.ts
-- by apps/cms/scripts/payload-migration-to-sql.mjs. Do not edit by hand:
-- change the collection, run `payload migrate:create`, and convert again.

CREATE SCHEMA IF NOT EXISTS cms;
ALTER TABLE "cms"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "cms"."users" ALTER COLUMN "role" DROP NOT NULL;
ALTER TABLE "cms"."users" ADD COLUMN IF NOT EXISTS "lumen_user_id" varchar;
CREATE UNIQUE INDEX IF NOT EXISTS "users_lumen_user_id_idx" ON "cms"."users" USING btree ("lumen_user_id");

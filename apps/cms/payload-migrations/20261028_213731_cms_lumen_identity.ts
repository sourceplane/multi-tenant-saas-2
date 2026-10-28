import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."users" ALTER COLUMN "role" DROP DEFAULT;
  ALTER TABLE "cms"."users" ALTER COLUMN "role" DROP NOT NULL;
  ALTER TABLE "cms"."users" ADD COLUMN "lumen_user_id" varchar;
  CREATE UNIQUE INDEX "users_lumen_user_id_idx" ON "cms"."users" USING btree ("lumen_user_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "cms"."users_lumen_user_id_idx";
  ALTER TABLE "cms"."users" ALTER COLUMN "role" SET DEFAULT 'editor';
  ALTER TABLE "cms"."users" ALTER COLUMN "role" SET NOT NULL;
  ALTER TABLE "cms"."users" DROP COLUMN "lumen_user_id";`)
}

-- Classes become a global catalogue shared by every business, and subclasses
-- become owned by a business instead. Each business's copy of a class is
-- merged into one global class per name (case-insensitively; the oldest copy
-- is kept), and the subclasses and payment items of the other copies are moved
-- onto it. Each subclass keeps the business of the class copy it was under.

-- AlterTable
ALTER TABLE "subclasses" ADD COLUMN "business_id" BIGINT;

UPDATE "subclasses" s
SET "business_id" = c."business_id"
FROM "classes" c
WHERE c."id" = s."class_id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "subclasses" WHERE "business_id" IS NULL) THEN
    RAISE EXCEPTION 'subclasses under a class without a business cannot be given an owner; assign those classes a business first';
  END IF;
END $$;

-- The class every copy with the same name is merged into
CREATE TEMPORARY TABLE "class_merge" ON COMMIT DROP AS
SELECT c."id" AS "old_id",
       MIN(c."id") OVER (PARTITION BY LOWER(c."name")) AS "new_id"
FROM "classes" c;

UPDATE "subclasses" s
SET "class_id" = m."new_id"
FROM "class_merge" m
WHERE m."old_id" = s."class_id"
  AND m."old_id" <> m."new_id";

UPDATE "payment_items" pi
SET "class_id" = m."new_id"
FROM "class_merge" m
WHERE m."old_id" = pi."class_id"
  AND m."old_id" <> m."new_id";

-- Nothing references the merged copies any more, so no subclass cascades away
DELETE FROM "classes" c
USING "class_merge" m
WHERE m."old_id" = c."id"
  AND m."old_id" <> m."new_id";

-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_business_id_fkey";

-- DropIndex
DROP INDEX "classes_business_id_name_key";
DROP INDEX "subclasses_class_id_name_key";

-- AlterTable
ALTER TABLE "classes" DROP COLUMN "business_id";
ALTER TABLE "subclasses" ALTER COLUMN "business_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");
CREATE UNIQUE INDEX "subclasses_class_id_business_id_name_key" ON "subclasses"("class_id", "business_id", "name");
CREATE INDEX "subclasses_business_id_idx" ON "subclasses"("business_id");

-- AddForeignKey
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Classes are now managed by the seeder, so subclasses are all schools create
UPDATE "permissions" SET "description" = 'Create subclasses', "updated_at" = NOW()
WHERE "name" = 'admin.class_management.create_class';
UPDATE "permissions" SET "description" = 'Rename or move subclasses', "updated_at" = NOW()
WHERE "name" = 'admin.class_management.update_class';
UPDATE "permissions" SET "description" = 'Delete subclasses', "updated_at" = NOW()
WHERE "name" = 'admin.class_management.delete_class';

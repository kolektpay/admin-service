-- Classes become owned by a business. The existing classes were shared by every
-- business, so each business gets its own copy of them (and their subclasses),
-- its students and payment items are moved onto that copy, and the shared rows
-- are removed.

-- Payment items without a business cannot be moved to a business's copy of their class
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "payment_items" WHERE "business_id" IS NULL) THEN
    RAISE EXCEPTION 'payment_items rows with a NULL business_id must be assigned a business before classes can be scoped to businesses';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "business_id" BIGINT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "description" DROP NOT NULL;

-- Temporary links from each copy back to the shared row it was made from
ALTER TABLE "classes" ADD COLUMN "legacy_class_id" BIGINT;
ALTER TABLE "subclasses" ADD COLUMN "legacy_subclass_id" BIGINT;

INSERT INTO "classes" ("business_id", "name", "category", "description", "legacy_class_id")
SELECT b."id", c."name", c."category", c."description", c."id"
FROM "classes" c
CROSS JOIN "businesses" b
WHERE c."business_id" IS NULL;

INSERT INTO "subclasses" ("class_id", "name", "updated_at", "legacy_subclass_id")
SELECT nc."id", s."name", CURRENT_TIMESTAMP, s."id"
FROM "subclasses" s
JOIN "classes" nc ON nc."legacy_class_id" = s."class_id";

UPDATE "students" st
SET "subclass_id" = ns."id"
FROM "subclasses" ns
JOIN "classes" nc ON nc."id" = ns."class_id"
WHERE ns."legacy_subclass_id" = st."subclass_id"
  AND nc."business_id" = st."business_id";

UPDATE "payment_items" pi
SET "class_id" = nc."id"
FROM "classes" nc
WHERE nc."legacy_class_id" = pi."class_id"
  AND nc."business_id" = pi."business_id";

UPDATE "payment_item_subclasses" pis
SET "subclass_id" = ns."id"
FROM "payment_items" pi, "subclasses" ns
JOIN "classes" nc ON nc."id" = ns."class_id"
WHERE pis."payment_item_id" = pi."id"
  AND ns."legacy_subclass_id" = pis."subclass_id"
  AND nc."business_id" = pi."business_id";

-- Students cascade-delete with their subclass, so refuse to continue if any
-- student is still on a shared subclass rather than lose them
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "students" st
    JOIN "subclasses" s ON s."id" = st."subclass_id"
    JOIN "classes" c ON c."id" = s."class_id"
    WHERE c."business_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'students still reference shared subclasses after copying classes to businesses';
  END IF;
END $$;

DELETE FROM "subclasses"
WHERE "class_id" IN (SELECT "id" FROM "classes" WHERE "business_id" IS NULL);

DELETE FROM "classes" WHERE "business_id" IS NULL;

ALTER TABLE "classes" DROP COLUMN "legacy_class_id";
ALTER TABLE "subclasses" DROP COLUMN "legacy_subclass_id";

ALTER TABLE "classes" ALTER COLUMN "business_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "classes_business_id_name_key" ON "classes"("business_id", "name");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A class's subclasses go with it; students no longer silently go with their
-- subclass, so deleting a subclass that still has students fails instead
ALTER TABLE "subclasses" DROP CONSTRAINT "subclasses_class_id_fkey";
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "students" DROP CONSTRAINT "students_subclass_id_fkey";
ALTER TABLE "students" ADD CONSTRAINT "students_subclass_id_fkey" FOREIGN KEY ("subclass_id") REFERENCES "subclasses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the class management permissions and grant them to the built-in manager role,
-- which already holds every other admin permission
INSERT INTO "permissions" ("name", "description", "type", "category", "created_at", "updated_at")
VALUES
  ('admin.menu.classmanagement', 'Access to class management', 'menu', 'admin', NOW(), NOW()),
  ('admin.class_management.read_class', 'View classes and subclasses', 'action', 'admin', NOW(), NOW()),
  ('admin.class_management.create_class', 'Create classes and subclasses', 'action', 'admin', NOW(), NOW()),
  ('admin.class_management.update_class', 'Rename or edit classes and subclasses', 'action', 'admin', NOW(), NOW()),
  ('admin.class_management.delete_class', 'Delete classes and subclasses', 'action', 'admin', NOW(), NOW()),
  ('admin.class_management.assign_student', 'Assign and transfer students between subclasses', 'action', 'admin', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_has_permissions" ("permission_id", "role_id")
SELECT p."id", r."id"
FROM "permissions" p
CROSS JOIN "roles" r
WHERE r."name" = 'manager'
  AND r."business_id" IS NULL
  AND p."name" IN (
    'admin.menu.classmanagement',
    'admin.class_management.read_class',
    'admin.class_management.create_class',
    'admin.class_management.update_class',
    'admin.class_management.delete_class',
    'admin.class_management.assign_student'
  )
ON CONFLICT DO NOTHING;

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'on_leave';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "expected_return_date" DATE,
ADD COLUMN     "leave_reason" TEXT;

-- AlterTable
-- Built-in roles keep business_id NULL; custom roles belong to the business that created them
ALTER TABLE "roles" ADD COLUMN     "business_id" BIGINT;

-- DropIndex
DROP INDEX "roles_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "roles_business_id_name_key" ON "roles"("business_id", "name");

-- CreateIndex
CREATE INDEX "user_has_roles_user_id_idx" ON "user_has_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_has_roles_business_id_role_id_idx" ON "user_has_roles"("business_id", "role_id");

-- CreateIndex
CREATE INDEX "role_has_permissions_role_id_idx" ON "role_has_permissions"("role_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the role management permissions and grant them to the built-in manager role,
-- which already holds every other admin permission
INSERT INTO "permissions" ("name", "description", "type", "category", "created_at", "updated_at")
VALUES
  ('admin.role_management.read_role', 'View roles and permissions', 'action', 'admin', NOW(), NOW()),
  ('admin.role_management.create_role', 'Create role', 'action', 'admin', NOW(), NOW()),
  ('admin.role_management.delete_role', 'Delete role', 'action', 'admin', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_has_permissions" ("permission_id", "role_id")
SELECT p."id", r."id"
FROM "permissions" p
CROSS JOIN "roles" r
WHERE r."name" = 'manager'
  AND r."business_id" IS NULL
  AND p."name" IN (
    'admin.role_management.read_role',
    'admin.role_management.create_role',
    'admin.role_management.delete_role'
  )
ON CONFLICT DO NOTHING;

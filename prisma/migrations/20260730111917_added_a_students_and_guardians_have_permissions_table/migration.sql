-- CreateEnum
CREATE TYPE "PermissionsCategory" AS ENUM ('admin', 'student', 'guardian', 'kolektsuperadmin');

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "category" "PermissionsCategory";

-- CreateTable
CREATE TABLE "students_and_guardians_have_permissions_table" (
    "id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "guardian_id" BIGINT NOT NULL,
    "permission_id" BIGINT NOT NULL,

    CONSTRAINT "students_and_guardians_have_permissions_table_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_and_guardians_have_permissions_table_student_id_gu_key" ON "students_and_guardians_have_permissions_table"("student_id", "guardian_id");

-- AddForeignKey
ALTER TABLE "students_and_guardians_have_permissions_table" ADD CONSTRAINT "students_and_guardians_have_permissions_table_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students_and_guardians_have_permissions_table" ADD CONSTRAINT "students_and_guardians_have_permissions_table_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students_and_guardians_have_permissions_table" ADD CONSTRAINT "students_and_guardians_have_permissions_table_permission_i_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

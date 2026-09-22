-- DropForeignKey
ALTER TABLE "students_and_guardians_have_permissions_table" DROP CONSTRAINT "students_and_guardians_have_permissions_table_guardian_id_fkey";

-- DropForeignKey
ALTER TABLE "students_and_guardians_have_permissions_table" DROP CONSTRAINT "students_and_guardians_have_permissions_table_student_id_fkey";

-- AlterTable
ALTER TABLE "students_and_guardians_have_permissions_table" ALTER COLUMN "student_id" DROP NOT NULL,
ALTER COLUMN "guardian_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "students_and_guardians_have_permissions_table" ADD CONSTRAINT "students_and_guardians_have_permissions_table_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students_and_guardians_have_permissions_table" ADD CONSTRAINT "students_and_guardians_have_permissions_table_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - A unique constraint covering the columns `[student_id,guardian_id,permission_id]` on the table `students_and_guardians_have_permissions_table` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "students_and_guardians_have_permissions_table_student_id_gu_key";

-- CreateIndex
CREATE UNIQUE INDEX "students_and_guardians_have_permissions_table_student_id_gu_key" ON "students_and_guardians_have_permissions_table"("student_id", "guardian_id", "permission_id");

-- DropForeignKey
ALTER TABLE "guardian_has_students" DROP CONSTRAINT "guardian_has_students_student_id_fkey";

-- AddForeignKey
ALTER TABLE "guardian_has_students" ADD CONSTRAINT "guardian_has_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

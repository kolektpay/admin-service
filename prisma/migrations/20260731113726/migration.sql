-- DropForeignKey
ALTER TABLE "guardian_has_students" DROP CONSTRAINT "guardian_has_students_guardian_id_fkey";

-- AddForeignKey
ALTER TABLE "guardian_has_students" ADD CONSTRAINT "guardian_has_students_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "password_history" ADD COLUMN     "student_id" BIGINT;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

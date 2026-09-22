-- DropForeignKey
ALTER TABLE "user_password_reset" DROP CONSTRAINT "user_password_reset_user_id_fkey";

-- AlterTable
ALTER TABLE "user_password_reset" ADD COLUMN     "student_id" BIGINT;

-- AddForeignKey
ALTER TABLE "user_password_reset" ADD CONSTRAINT "user_password_reset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_password_reset" ADD CONSTRAINT "user_password_reset_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

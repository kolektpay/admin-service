-- AlterTable
ALTER TABLE "password_history" ADD COLUMN     "guardian_id" BIGINT;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

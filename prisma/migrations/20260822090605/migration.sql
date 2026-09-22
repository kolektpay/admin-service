-- AlterTable
ALTER TABLE "students_and_guardians_have_permissions_table" ADD COLUMN     "business_id" BIGINT;

-- AddForeignKey
ALTER TABLE "students_and_guardians_have_permissions_table" ADD CONSTRAINT "students_and_guardians_have_permissions_table_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

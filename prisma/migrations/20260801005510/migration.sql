-- AlterTable
ALTER TABLE "guardians" ADD COLUMN     "business_id" BIGINT;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

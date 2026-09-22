-- AlterTable
ALTER TABLE "payment_items" ADD COLUMN     "business_id" BIGINT;

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `deactivated_at` on the `payment_items` table. All the data in the column will be lost.
  - You are about to drop the column `outstandingBalance` on the `payment_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "deactivated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payment_items" DROP COLUMN "deactivated_at",
DROP COLUMN "outstandingBalance",
ADD COLUMN     "updated_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "invoices_deactivated_at_idx" ON "invoices"("deactivated_at");

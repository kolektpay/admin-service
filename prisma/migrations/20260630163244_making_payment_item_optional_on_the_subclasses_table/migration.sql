/*
  Warnings:

  - You are about to drop the column `paymentItemId` on the `subclasses` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "subclasses" DROP CONSTRAINT "subclasses_paymentItemId_fkey";

-- AlterTable
ALTER TABLE "subclasses" DROP COLUMN "paymentItemId",
ADD COLUMN     "payment_item_id" BIGINT;

-- AddForeignKey
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_payment_item_id_fkey" FOREIGN KEY ("payment_item_id") REFERENCES "payment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

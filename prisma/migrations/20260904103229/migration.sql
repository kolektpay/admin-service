/*
  Warnings:

  - You are about to drop the column `invoice_date` on the `payment_items` table. All the data in the column will be lost.
  - You are about to drop the column `invoice_number` on the `payment_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "payment_items" DROP COLUMN "invoice_date",
DROP COLUMN "invoice_number";

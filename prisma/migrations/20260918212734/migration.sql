/*
  Warnings:

  - Added the required column `amount` to the `receipts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "amount" DECIMAL(15,2) NOT NULL;

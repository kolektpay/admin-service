/*
  Warnings:

  - The values [active] on the enum `PaymentItemStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentItemStatus_new" AS ENUM ('approved', 'inactive', 'rejected', 'cancelled', 'pending');
ALTER TABLE "public"."payment_items" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payment_items" ALTER COLUMN "status" TYPE "PaymentItemStatus_new" USING ("status"::text::"PaymentItemStatus_new");
ALTER TYPE "PaymentItemStatus" RENAME TO "PaymentItemStatus_old";
ALTER TYPE "PaymentItemStatus_new" RENAME TO "PaymentItemStatus";
DROP TYPE "public"."PaymentItemStatus_old";
ALTER TABLE "payment_items" ALTER COLUMN "status" SET DEFAULT 'inactive';
COMMIT;

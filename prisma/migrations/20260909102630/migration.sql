/*
  Warnings:

  - The values [instant_pay] on the enum `PaymentType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentType_new" AS ENUM ('wallet', 'widget');
ALTER TABLE "public"."payment_items" ALTER COLUMN "payment_type" DROP DEFAULT;
ALTER TABLE "payment_items" ALTER COLUMN "payment_type" TYPE "PaymentType_new"[] USING ("payment_type"::text::"PaymentType_new"[]);
ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
ALTER TYPE "PaymentType_new" RENAME TO "PaymentType";
DROP TYPE "public"."PaymentType_old";
ALTER TABLE "payment_items" ALTER COLUMN "payment_type" SET DEFAULT ARRAY[]::"PaymentType"[];
COMMIT;

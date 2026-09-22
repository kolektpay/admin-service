-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('wallet', 'instant_pay');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentItemStatus" ADD VALUE 'rejected';
ALTER TYPE "PaymentItemStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "payment_items" ADD COLUMN     "payment_type" "PaymentType"[] DEFAULT ARRAY[]::"PaymentType"[];

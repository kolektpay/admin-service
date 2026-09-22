-- AlterTable
ALTER TABLE "payment_items" ALTER COLUMN "payment_type" SET NOT NULL,
ALTER COLUMN "payment_type" SET DATA TYPE "PaymentType"[] USING "payment_type"::"PaymentType"[];

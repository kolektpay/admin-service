-- CreateEnum
CREATE TYPE "PaymentItemStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "payment_items" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "class_id" BIGINT NOT NULL,
    "status" "PaymentItemStatus" NOT NULL DEFAULT 'inactive',
    "payment_description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),

    CONSTRAINT "payment_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

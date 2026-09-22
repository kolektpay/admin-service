-- CreateTable
CREATE TABLE "receipts" (
    "id" BIGSERIAL NOT NULL,
    "name_of_student" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date_of_payment" TIMESTAMP(3) NOT NULL,
    "outstanding_balance" DECIMAL(15,2) NOT NULL,
    "receipt_number" BIGINT NOT NULL,
    "invoice_id" BIGINT NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

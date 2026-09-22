import prisma from "../config/database";

interface StudentInvoiceWithPaymentStatus {
  invoice_number: string;
  description: string;
  end_date: Date;
  start_date: Date;
  payment_item_id: bigint;
  status: string;
  invoice_amount: string; // Prisma returns Decimal as string via $queryRaw
  total_receipt_amount: string;
  payment_status: "Unpaid" | "Part Payment" | "Full Payment";
}

export async function getPendingInvoicesWithPaymentStatusForStudent(
  studentId: bigint,
): Promise<StudentInvoiceWithPaymentStatus[]> {
  return await prisma.$queryRaw<StudentInvoiceWithPaymentStatus[]>`
    SELECT
      i.invoice_number,
      pi.description,
        i.businessId,
      pi.end_date,
      pi.start_date,
      i.payment_item_id,
      i.status,
      i.amount AS invoice_amount,
      COALESCE(SUM(r.amount), 0) AS total_receipt_amount,
      CASE
          WHEN COUNT(r.id) = 0 THEN 'Unpaid'
          WHEN COALESCE(SUM(r.amount), 0) < i.amount THEN 'Part Payment'
          WHEN COALESCE(SUM(r.amount), 0) >= i.amount THEN 'Full Payment'
      END AS payment_status
    FROM invoices i
    LEFT JOIN payment_items pi ON pi.id = i.payment_item_id
    LEFT JOIN receipts r ON r.invoice_id = i.id
    WHERE i.student_id = ${studentId} AND i.status = 'pending'
    GROUP BY
      i.id,
      i.invoice_number,
      i.payment_item_id,
      pi.description,
      pi.end_date,
      i.businessId,
      pi.start_date,
      i.status,
      i.amount;
  `;
}
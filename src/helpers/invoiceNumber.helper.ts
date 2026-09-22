import prisma from "../config/database";

const INVOICE_PREFIX = "INV-";
const INVOICE_PAD_LENGTH = 7; // INV-0000001

/**
 * Checks the Invoices table for the latest invoice number,
 * increments it by 1, and returns the new formatted invoice number.
 * If no invoice exists yet, starts a fresh sequence at 1.
 */
export async function generateNextInvoiceNumber(): Promise<string> {
  // Order by id descending since id is a BigInt autoincrement column,
  // which is a more reliable "latest" indicator than sorting the
  // invoiceNumber string itself.
  const lastInvoice = await prisma.invoices.findFirst({
    orderBy: {
      id: "desc",
    },
    select: {
      invoiceNumber: true,
    },
  });

  let nextNumber: number;

  if (lastInvoice && lastInvoice.invoiceNumber) {
    // Extract the numeric part from something like "INV-0000047"
    const numericPart = lastInvoice.invoiceNumber.replace(INVOICE_PREFIX, "");
    const parsedNumber = parseInt(numericPart, 10);

    if (isNaN(parsedNumber)) {
      // Fallback in case an existing row doesn't match the expected format
      nextNumber = 1;
    } else {
      nextNumber = parsedNumber + 1;
    }
  } else {
    // No invoice exists yet, start fresh
    nextNumber = 1;
  }

  const formattedInvoiceNumber = `${INVOICE_PREFIX}${nextNumber
    .toString()
    .padStart(INVOICE_PAD_LENGTH, "0")}`;

  return formattedInvoiceNumber;
}
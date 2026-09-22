import { z } from "zod";

export const transactionWalletIdParamsSchema = z.object({
  walletId: z.int(),
});

export const transactionQuerySchema = z.object({
  pageInteger: z.coerce.number().int().positive(),
  limitInteger: z.coerce.number().int().positive(),
  type: z.enum(["credit", "debit"]),
  status: z.enum(["pending", "paid", "completed", "cancelled"]),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
});


export const transactionReferenceNumberParamsSchema = z.object({
  referenceNumber: z.int(),
});

import { z } from "zod";

// Key must match the route param name exactly ("/wallets/:walletid")
export const transactionWalletIdParamsSchema = z.object({
  walletid: z.uuid(),
});

// Filters are optional - the handler defaults the date range to the last 7 days
export const transactionQuerySchema = z.object({
  pageInteger: z.coerce.number().int().positive().optional(),
  limitInteger: z.coerce.number().int().positive().optional(),
  type: z.enum(["credit", "debit"]).optional(),
  status: z.enum(["pending", "paid", "completed", "cancelled"]).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});


// Key must match the route param name exactly ("/reference/:referencenumber")
export const transactionReferenceNumberParamsSchema = z.object({
  referencenumber: z.string().trim().min(1).max(100),
});

// ==========================================
// Wallet service transaction schemas
// Query param names match the wallet service API exactly
// ==========================================

export const MAX_TRANSACTIONS_PER_PAGE = 100;

const transactionDateSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

export const walletTransactionHistoryParamsSchema = z.object({
  walletId: z.uuid(),
});

export const walletTransactionHistoryQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_TRANSACTIONS_PER_PAGE).default(10),
    transaction_type: z.enum(["credit", "debit"]).optional(),
    status: z.enum(["pending", "completed", "failed", "cancelled"]).optional(),
    from_date: transactionDateSchema.optional(),
    to_date: transactionDateSchema.optional(),
  })
  .refine(
    (value) =>
      !value.from_date || !value.to_date || new Date(value.from_date) <= new Date(value.to_date),
    { message: "from_date must be before to_date", path: ["to_date"] },
  );

export const transactionReferenceParamsSchema = z.object({
  reference: z.string().trim().min(1).max(100),
});

export const walletActivityQuerySchema = z
  .object({
    walletId: z.uuid(),
    From: transactionDateSchema.optional(),
    To: transactionDateSchema.optional(),
    PageNumber: z.coerce.number().int().positive().optional(),
    PageSize: z.coerce.number().int().positive().max(MAX_TRANSACTIONS_PER_PAGE).optional(),
  })
  .refine(
    (value) => !value.From || !value.To || new Date(value.From) <= new Date(value.To),
    { message: "From must be before To", path: ["To"] },
  );

export const simulateInflowBodySchema = z.object({
  beneficiaryAccountName: z.string().trim().min(1),
  beneficiaryAccountNumber: z.string().trim().regex(/^\d+$/, {
    message: "beneficiaryAccountNumber must contain digits only",
  }),
  // The wallet service expects amount as a string, e.g. "10000000"
  amount: z
    .union([
      z.string().trim().regex(/^\d+(\.\d+)?$/, { message: "amount must be a number" }),
      z.number().positive(),
    ])
    .transform(String),
  narration: z.string().trim().min(1).max(255),
});

export type WalletTransactionHistoryQuery = z.infer<typeof walletTransactionHistoryQuerySchema>;
export type WalletActivityQuery = z.infer<typeof walletActivityQuerySchema>;
export type SimulateInflowBody = z.infer<typeof simulateInflowBodySchema>;

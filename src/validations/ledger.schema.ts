import { z } from "zod";

export const MAX_LEDGER_ENTRIES_PER_PAGE = 100;

// The wallet service accepts ISO dates ("2026-04-01") or date-times ("2026-04-01T00:00:00Z")
const dateSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

const startBeforeEnd = (value: { startDate?: string; endDate?: string }) =>
  !value.startDate || !value.endDate || new Date(value.startDate) <= new Date(value.endDate);

const dateOrderMessage = { message: "startDate must be before endDate", path: ["endDate"] };

// walletId is required here (optional on the wallet service) so a request can
// never pull ledger entries for every wallet on the platform
export const ledgerQuerySchema = z
  .object({
    walletId: z.string().trim().min(1),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_LEDGER_ENTRIES_PER_PAGE).default(10),
  })
  .refine(startBeforeEnd, dateOrderMessage);

export const ledgerExportQuerySchema = z
  .object({
    walletId: z.string().trim().min(1),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  .refine(startBeforeEnd, dateOrderMessage);

export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
export type LedgerExportQuery = z.infer<typeof ledgerExportQuerySchema>;

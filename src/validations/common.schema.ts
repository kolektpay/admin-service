import { z } from "zod";

/**
 * A calendar date sent as YYYY-MM-DD, parsed to midnight UTC.
 */
export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Dates must be in YYYY-MM-DD format" })
  // Round-trip check rejects dates JS would silently roll over (e.g. 2026-02-30)
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    },
    { message: "Invalid calendar date" },
  )
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

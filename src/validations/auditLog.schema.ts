import { AuditLoginResult } from "@prisma/client";
import { z } from "zod";

export const MAX_AUDIT_LOGS_PER_PAGE = 100;

const bigintIdSchema = z
  .string()
  .regex(/^\d+$/, { message: "must be a positive integer" })
  .transform((value) => BigInt(value));

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Shared by every audit log endpoint: paging, outcome and time window
const baseAuditLogQuery = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_AUDIT_LOGS_PER_PAGE)
    .default(20),
  result: z.enum(AuditLoginResult).optional(),
  // An exact action code (student.blocked) or a whole area (auth.*)
  action: z
    .string()
    .trim()
    .regex(/^[a-z_]+\.([a-z_]+|\*)$/, {
      message: "action must be a code like student.blocked, or an area like auth.*",
    })
    .optional(),
  from: z.coerce.date().optional(),
  // A date-only "to" covers that whole day (UTC), so to=2026-10-14 includes the 14th
  to: z
    .preprocess(
      (value) =>
        typeof value === "string" && DATE_ONLY.test(value.trim())
          ? `${value.trim()}T23:59:59.999Z`
          : value,
      z.coerce.date(),
    )
    .optional(),
};

const fromBeforeTo = (query: { from?: Date; to?: Date }) =>
  !query.from || !query.to || query.from <= query.to;
const fromBeforeToMessage = { message: "from must be before to", path: ["from"] };

export const listAuditLogsQuerySchema = z
  .strictObject({
    ...baseAuditLogQuery,
    // Whose activity to show; omit to show everyone in the business
    actorType: z.enum(["admin", "student", "guardian"]).optional(),
  })
  .refine(fromBeforeTo, fromBeforeToMessage);

// One administrator's logs (/me and /:userId): only what they did
export const listOwnAuditLogsQuerySchema = z
  .strictObject(baseAuditLogQuery)
  .refine(fromBeforeTo, fromBeforeToMessage);

// One student's or guardian's logs. By default only what they did themselves;
// include=received also returns what administrators did to the account.
export const listAccountAuditLogsQuerySchema = z
  .strictObject({
    ...baseAuditLogQuery,
    include: z.enum(["received"]).optional(),
  })
  .refine(fromBeforeTo, fromBeforeToMessage);

// ==========================================
// Path parameters: the account whose logs are requested
// ==========================================

export const auditLogUserParamsSchema = z.object({
  userId: z.uuid({ message: "userId must be a valid UUID" }),
});

export const auditLogStudentParamsSchema = z.object({
  studentId: bigintIdSchema,
});

export const auditLogGuardianParamsSchema = z.object({
  guardianId: bigintIdSchema,
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
export type ListOwnAuditLogsQuery = z.infer<typeof listOwnAuditLogsQuerySchema>;
export type ListAccountAuditLogsQuery = z.infer<typeof listAccountAuditLogsQuerySchema>;

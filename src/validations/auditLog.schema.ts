import { AuditActorType, AuditLoginResult } from "@prisma/client";
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
  // The search box: matches the actor's or the target's name
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
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
    actorType: z.enum(AuditActorType).optional(),
  })
  .refine(fromBeforeTo, fromBeforeToMessage);

// Your own logs (/me): only what you did
export const listOwnAuditLogsQuerySchema = z
  .strictObject(baseAuditLogQuery)
  .refine(fromBeforeTo, fromBeforeToMessage);

// Administrators' logs: one administrator with userId, otherwise all of them
export const listAdminsAuditLogsQuerySchema = z
  .strictObject({
    ...baseAuditLogQuery,
    userId: z.uuid({ message: "userId must be a valid UUID" }).optional(),
  })
  .refine(fromBeforeTo, fromBeforeToMessage);

// By default (all) what the account(s) did plus what administrators (and, for
// students, guardians) did to them; own is only what they did themselves
const accountScope = z.enum(["all", "own"]).default("all");

// Students' logs: one student with studentId, otherwise all of them
export const listStudentsAuditLogsQuerySchema = z
  .strictObject({
    ...baseAuditLogQuery,
    studentId: bigintIdSchema.optional(),
    scope: accountScope,
  })
  .refine(fromBeforeTo, fromBeforeToMessage);

// Guardians' logs: one guardian with guardianId, otherwise all of them
export const listGuardiansAuditLogsQuerySchema = z
  .strictObject({
    ...baseAuditLogQuery,
    guardianId: bigintIdSchema.optional(),
    scope: accountScope,
  })
  .refine(fromBeforeTo, fromBeforeToMessage);

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
export type ListOwnAuditLogsQuery = z.infer<typeof listOwnAuditLogsQuerySchema>;
export type ListAdminsAuditLogsQuery = z.infer<typeof listAdminsAuditLogsQuerySchema>;
export type ListStudentsAuditLogsQuery = z.infer<typeof listStudentsAuditLogsQuerySchema>;
export type ListGuardiansAuditLogsQuery = z.infer<typeof listGuardiansAuditLogsQuerySchema>;

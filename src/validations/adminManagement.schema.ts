import { UserStatus } from "@prisma/client";
import { z } from "zod";

import { calendarDateSchema } from "./common.schema";

export const MAX_ADMINS_PER_PAGE = 100;
export const MAX_ROLES_PER_ADMIN = 10;

const roleIdSchema = z.coerce
  .number()
  .int()
  .positive({ message: "roleId must be a positive integer" })
  .transform((value) => BigInt(value));

// Duplicates are dropped, keeping the order given
const roleIdsSchema = z
  .array(roleIdSchema)
  .min(1, { message: "At least one role is required" })
  .max(MAX_ROLES_PER_ADMIN, {
    message: `An administrator can have at most ${MAX_ROLES_PER_ADMIN} roles`,
  })
  .transform((roleIds) => [...new Set(roleIds)]);

const notBothRoleFields = {
  check: (data: { roleId?: unknown; roleIds?: unknown }) =>
    data.roleId === undefined || data.roleIds === undefined,
  params: { message: "Send roleIds or roleId, not both", path: ["roleId"] },
};

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Please provide a valid email address" }).max(255));

// Names are stored lower-cased, matching existing admin records
const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .min(2, { message: `${label} must be at least 2 characters` })
    .max(50, { message: `${label} must not exceed 50 characters` });

// users.phone_number is VARCHAR(15)
const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?\d{7,14}$/, { message: "Invalid phone number" });

const reasonSchema = z.string().trim().min(3).max(255);

export const adminIdParamsSchema = z.object({
  id: z.uuid({ message: "Invalid user ID format" }),
});

// ==========================================
// Listing
// ==========================================

export const listAdminsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_ADMINS_PER_PAGE).default(10),
  role: z.string().trim().min(1).max(50).optional(),
  status: z.enum(UserStatus).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().min(1).max(255).optional(),
  // Matches email, first name or last name (kept for existing clients)
  search: z.string().trim().min(1).max(100).optional(),
});

// ==========================================
// Create / update
// ==========================================

export const createAdminSchema = z
  .strictObject({
    email: emailSchema,
    firstName: nameSchema("First name"),
    lastName: nameSchema("Last name"),
    phoneNumber: phoneNumberSchema.optional(),
    roleIds: roleIdsSchema.optional(),
    // Earlier clients sent roleId, as a number or an array
    roleId: z
      .union([roleIdSchema.transform((roleId) => [roleId]), roleIdsSchema])
      .optional(),
  })
  .refine((data) => data.roleIds !== undefined || data.roleId !== undefined, {
    message: "At least one role is required",
    path: ["roleIds"],
  })
  .refine(notBothRoleFields.check, notBothRoleFields.params)
  .transform(({ roleId, roleIds, ...profile }) => ({
    ...profile,
    roleIds: (roleIds ?? roleId) as bigint[],
  }));

export const updateAdminSchema = z
  .strictObject({
    email: emailSchema,
    firstName: nameSchema("First name"),
    lastName: nameSchema("Last name"),
    phoneNumber: phoneNumberSchema.nullable(),
    // The complete set of roles the administrator should hold
    roleIds: roleIdsSchema,
    // Earlier clients sent a single roleId, which replaces every role
    roleId: roleIdSchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(notBothRoleFields.check, notBothRoleFields.params)
  .transform(({ roleId, ...input }) => ({
    ...input,
    ...(roleId !== undefined && { roleIds: [roleId] }),
  }));

export const setAdminRolesSchema = z.strictObject({ roleIds: roleIdsSchema });

// ==========================================
// Status
// ==========================================

const isAfterToday = (date: Date): boolean => {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return date.getTime() > todayUtc;
};

export const updateAdminStatusSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("blocked"),
    reason: reasonSchema.optional(),
  }),
  z.strictObject({
    status: z.literal("on_leave"),
    reason: reasonSchema,
    expectedReturnDate: calendarDateSchema.refine(isAfterToday, {
      message: "expectedReturnDate must be a future date",
    }),
  }),
]);

// Body of the legacy POST /users/roles/assign endpoint. "assign" adds the
// roles; "unassign" removes the given roles, or all of them when omitted.
export const roleAssignmentSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("assign"),
    userId: z.uuid({ message: "Invalid user ID format" }),
    roleIds: roleIdsSchema,
  }),
  z.strictObject({
    action: z.literal("unassign"),
    userId: z.uuid({ message: "Invalid user ID format" }),
    roleIds: roleIdsSchema.optional(),
  }),
]);

export type ListAdminsQuery = z.infer<typeof listAdminsQuerySchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;
export type SetAdminRolesInput = z.infer<typeof setAdminRolesSchema>;
export type UpdateAdminStatusInput = z.infer<typeof updateAdminStatusSchema>;

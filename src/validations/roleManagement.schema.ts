import { PermissionType } from "@prisma/client";
import { z } from "zod";

export const MAX_ROLES_PER_PAGE = 100;
export const MAX_PERMISSIONS_PER_PAGE = 200;
export const MAX_PERMISSIONS_PER_ROLE = 200;

const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .transform((value) => BigInt(value));

const searchSchema = z.string().trim().min(1).max(100);

// ==========================================
// Permissions listing
// ==========================================

export const listPermissionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PERMISSIONS_PER_PAGE)
    .default(MAX_PERMISSIONS_PER_PAGE),
  type: z.enum(PermissionType).optional(),
  search: searchSchema.optional(),
});

// ==========================================
// Roles
// ==========================================

export const listRolesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_ROLES_PER_PAGE).default(10),
  search: searchSchema.optional(),
});

// Role names are compared case-insensitively, so whitespace is collapsed
// to stop "Bursar" and "Bursar  " being treated as different roles.
export const roleNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, { message: "Role name must be at least 2 characters" })
      .max(50, { message: "Role name must not exceed 50 characters" })
      .regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, {
        message:
          "Role name may only contain letters, numbers, spaces, '_' and '-'",
      }),
  );

export const createRoleSchema = z.strictObject({
  name: roleNameSchema,
  permissionIds: z
    .array(idSchema)
    .min(1, { message: "At least one permission is required" })
    .max(MAX_PERMISSIONS_PER_ROLE)
    // Repeated IDs would otherwise violate the role_has_permissions primary key
    .transform((ids) => [...new Set(ids)]),
});

export const roleIdParamsSchema = z.object({
  roleId: z
    .string()
    .regex(/^\d+$/, { message: "roleId must be a positive integer" })
    .transform((value) => BigInt(value)),
});

export const updateRolePermissionsSchema = z.strictObject({
  permissionIds: z
    .array(idSchema)
    .min(1, { message: "At least one permission is required" })
    .max(MAX_PERMISSIONS_PER_ROLE)
    .transform((ids) => [...new Set(ids)]),
});

export type ListPermissionsQuery = z.infer<typeof listPermissionsQuerySchema>;
export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;

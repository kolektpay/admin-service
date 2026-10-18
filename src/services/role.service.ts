import { Prisma } from "@prisma/client";

import prisma from "../config/database";
import { isPrismaErrorCode } from "../helpers/prismaError.helper";
import { AdminActor } from "../interfaces/admin.interfaces";
import { IFieldError } from "../interfaces/common.interface";
import { AppError } from "../middleware/error.middleware";
import { AuditModel } from "../models/audit.model";
import {
  CreateRoleInput,
  ListPermissionsQuery,
  ListRolesQuery,
  UpdateRolePermissionsInput,
} from "../validations/roleManagement.schema";

// ==========================================
// Shared helpers
// ==========================================

// The business owner's built-in role. There is one manager per business,
// set up during onboarding, so it is never assigned through these APIs.
export const MANAGER_ROLE_NAME = "manager";

// Staff roles only carry admin permissions; student and guardian
// permissions are granted to those accounts directly.
const assignablePermissionWhere = {
  category: "admin",
  isBlacklisted: false,
} satisfies Prisma.PermissionsWhereInput;

const permissionSelect = {
  id: true,
  name: true,
  description: true,
  type: true,
} satisfies Prisma.PermissionsSelect;

// Assignments held by soft-deleted administrators do not keep a role in use
const activeAssignmentWhere = {
  user: { deletedAt: null },
} satisfies Prisma.UserHasRoleWhereInput;

/** Built-in roles (no business) plus the business's own custom roles. */
export const rolesVisibleTo = (businessId: bigint): Prisma.RoleWhereInput => ({
  OR: [{ businessId: null }, { businessId }],
});

const roleSelect = (businessId: bigint) =>
  ({
    id: true,
    name: true,
    type: true,
    businessId: true,
    createdAt: true,
    updatedAt: true,
    permissions: {
      select: { permission: { select: permissionSelect } },
      orderBy: { permission: { name: "asc" } },
    },
    _count: {
      select: {
        userHasRoles: { where: { businessId, ...activeAssignmentWhere } },
      },
    },
  }) satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: ReturnType<typeof roleSelect> }>;

const toRoleRecord = ({ businessId, permissions, _count, ...role }: RoleRow) => ({
  ...role,
  scope: businessId === null ? ("system" as const) : ("business" as const),
  assignedAdminsCount: _count.userHasRoles,
  permissions: permissions.map(({ permission }) => permission),
});

export type RoleRecord = ReturnType<typeof toRoleRecord>;

const paginate = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const roleNotFoundError = () =>
  new AppError("Role not found", 404, "ROLE_NOT_FOUND");

const roleNameTakenError = () =>
  new AppError("A role with this name already exists", 409, "ROLE_NAME_TAKEN", [
    { field: "name", message: "A role with this name already exists" },
  ]);

const roleInUseError = (count?: number) =>
  new AppError(
    count
      ? `This role is assigned to ${count} administrator(s). Reassign them before deleting it.`
      : "This role is assigned to one or more administrators. Reassign them before deleting it.",
    409,
    "ROLE_IN_USE",
  );

/** Reject IDs that do not exist or are not admin, non-blacklisted permissions. */
const assertAssignablePermissions = async (permissionIds: bigint[]): Promise<void> => {
  const permissions = await prisma.permissions.findMany({
    where: { id: { in: permissionIds }, ...assignablePermissionWhere },
    select: { id: true },
  });
  const validIds = new Set(permissions.map(({ id }) => id));
  const invalid = permissionIds.filter((id) => !validIds.has(id));

  if (invalid.length) {
    throw new AppError(
      "One or more permissions do not exist or cannot be assigned to a role",
      400,
      "INVALID_PERMISSION",
      invalid.map(
        (id): IFieldError => ({
          field: "permissionIds",
          message: `Permission ${id} does not exist or cannot be assigned to a role`,
        }),
      ),
    );
  }
};

/**
 * Reject a grant of permissions the acting staff member does not hold
 * themselves, so a role cannot be used to escalate the actor's own access.
 */
export const assertActorHoldsPermissions = async (
  actor: AdminActor,
  permissionIds: bigint[],
  field: string,
): Promise<void> => {
  const held = await prisma.roleHasPermission.findMany({
    where: { role: { userHasRoles: { some: { userId: actor.userId } } } },
    select: { permissionId: true },
  });
  const heldIds = new Set(held.map(({ permissionId }) => permissionId));
  const missing = permissionIds.filter((id) => !heldIds.has(id));

  if (missing.length) {
    throw new AppError(
      "You cannot grant permissions that you do not hold yourself",
      403,
      "PERMISSION_ESCALATION",
      missing.map((id) => ({
        field,
        message: `You do not hold permission ${id}`,
      })),
    );
  }
};

// ==========================================
// Permissions
// ==========================================

/**
 * List the permissions that can be granted to a staff role.
 */
export const listPermissions = async (query: ListPermissionsQuery) => {
  const { page, limit, type, search } = query;

  const where: Prisma.PermissionsWhereInput = {
    ...assignablePermissionWhere,
    ...(type && { type }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [permissions, total] = await Promise.all([
    prisma.permissions.findMany({
      where,
      select: permissionSelect,
      orderBy: [{ type: "asc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.permissions.count({ where }),
  ]);

  return { permissions, pagination: paginate(page, limit, total) };
};

// ==========================================
// Roles
// ==========================================

/**
 * List the roles available to a business with their permissions.
 * Prisma loads every page's permissions in one batched query.
 */
export const listRoles = async (businessId: bigint, query: ListRolesQuery) => {
  const { page, limit, search } = query;

  const where: Prisma.RoleWhereInput = {
    AND: [
      rolesVisibleTo(businessId),
      ...(search ? [{ name: { contains: search, mode: "insensitive" as const } }] : []),
    ],
  };

  const [roles, total] = await Promise.all([
    prisma.role.findMany({
      where,
      select: roleSelect(businessId),
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.role.count({ where }),
  ]);

  return { roles: roles.map(toRoleRecord), pagination: paginate(page, limit, total) };
};

/**
 * Create a custom role for the actor's business and grant it permissions.
 * Names must be unique (case-insensitively) among the roles the business
 * can see, including built-in roles.
 */
export const createRole = async (
  input: CreateRoleInput,
  actor: AdminActor,
): Promise<RoleRecord> => {
  const nameTaken = await prisma.role.findFirst({
    where: {
      AND: [
        rolesVisibleTo(actor.businessId),
        { name: { equals: input.name, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (nameTaken) throw roleNameTakenError();

  await assertAssignablePermissions(input.permissionIds);

  await assertActorHoldsPermissions(actor, input.permissionIds, "permissionIds");

  try {
    return await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: input.name,
          type: "custom",
          businessId: actor.businessId,
          permissions: {
            createMany: {
              data: input.permissionIds.map((permissionId) => ({ permissionId })),
            },
          },
        },
        select: roleSelect(actor.businessId),
      });
      await AuditModel.logRoleCreated(actor, role.id, role.name, tx);
      return toRoleRecord(role);
    });
  } catch (error) {
    // Lost a race with a concurrent request creating the same name
    if (isPrismaErrorCode(error, "P2002")) throw roleNameTakenError();
    throw error;
  }
};

/**
 * Replace the full set of permissions on an existing custom role.
 * Only newly granted permissions go through the escalation guard, so an
 * actor can still trim a role that holds permissions they lack.
 */
export const updateRolePermissions = async (
  roleId: bigint,
  input: UpdateRolePermissionsInput,
  actor: AdminActor,
): Promise<RoleRecord> => {
  const role = await prisma.role.findFirst({
    where: { id: roleId, ...rolesVisibleTo(actor.businessId) },
    select: {
      id: true,
      name: true,
      businessId: true,
      permissions: { select: { permissionId: true } },
    },
  });
  if (!role) throw roleNotFoundError();
  if (role.businessId === null)
    throw new AppError("Built-in roles cannot be modified", 403, "SYSTEM_ROLE");

  await assertAssignablePermissions(input.permissionIds);

  const currentIds = new Set(role.permissions.map(({ permissionId }) => permissionId));
  const desiredIds = new Set(input.permissionIds);
  const added = input.permissionIds.filter((id) => !currentIds.has(id));
  const removed = [...currentIds].filter((id) => !desiredIds.has(id));

  await assertActorHoldsPermissions(actor, added, "permissionIds");

  return await prisma.$transaction(async (tx) => {
    // Written against the desired set rather than the diff, so a concurrent
    // update cannot leave the role holding permissions outside this request
    await tx.roleHasPermission.deleteMany({
      where: { roleId, permissionId: { notIn: input.permissionIds } },
    });
    await tx.roleHasPermission.createMany({
      data: input.permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
    if (added.length || removed.length) {
      await AuditModel.logRolePermissionsUpdated(actor, roleId, role.name, added, removed, tx);
    }
    const updated = await tx.role.findUniqueOrThrow({
      where: { id: roleId },
      select: roleSelect(actor.businessId),
    });
    return toRoleRecord(updated);
  });
};

/**
 * Delete one of the business's custom roles. Built-in roles cannot be
 * deleted, and a role cannot be deleted while an administrator holds it.
 */
export const deleteRole = async (
  roleId: bigint,
  actor: AdminActor,
): Promise<void> => {
  const role = await prisma.role.findFirst({
    where: { id: roleId, ...rolesVisibleTo(actor.businessId) },
    select: {
      id: true,
      name: true,
      businessId: true,
      _count: { select: { userHasRoles: { where: activeAssignmentWhere } } },
    },
  });

  if (!role) throw roleNotFoundError();

  if (role.businessId === null) {
    throw new AppError("Built-in roles cannot be deleted", 403, "SYSTEM_ROLE");
  }

  if (role._count.userHasRoles > 0) throw roleInUseError(role._count.userHasRoles);

  await prisma.$transaction(async (tx) => {
    await tx.roleHasPermission.deleteMany({ where: { roleId } });

    // Re-checked in the delete itself: an assignment made after the check
    // above must not be silently removed by the ON DELETE CASCADE
    const { count } = await tx.role.deleteMany({
      where: {
        id: roleId,
        businessId: actor.businessId,
        userHasRoles: { none: activeAssignmentWhere },
      },
    });
    if (count === 0) throw roleInUseError();

    await AuditModel.logRoleDeleted(actor, roleId, role.name, tx);
  });
};

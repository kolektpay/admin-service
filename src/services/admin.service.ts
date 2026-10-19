import { Prisma, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";

import prisma from "../config/database";
import { addDays, getCurrentTimestamp } from "../helpers/date.helper";
import { isPrismaErrorCode } from "../helpers/prismaError.helper";
import { AdminActor } from "../interfaces/admin.interfaces";
import { IUserResponse } from "../interfaces/user.interface";
import { TempPasswordTokenManager } from "../managers/tempPasswordTokenManager";
import { AppError } from "../middleware/error.middleware";
import { AuditModel } from "../models/audit.model";
import { NotificationModel } from "../models/notifications.model";
import {
  AdminPublicRecord,
  adminPublicSelect,
  toAdminRecord,
} from "../models/user.model";
import ApiError from "../utils/apiError";
import {
  CreateAdminInput,
  ListAdminsQuery,
  UpdateAdminInput,
  UpdateAdminStatusInput,
} from "../validations/adminManagement.schema";
import {
  assertActorHoldsPermissions,
  MANAGER_ROLE_NAME,
  rolesVisibleTo,
} from "./role.service";

const saltRounds: number = Number(process.env.SALT_ROUNDS) || 13;
const PASSWORD_LIFETIME_DAYS = 90;

// ==========================================
// Shared helpers
// ==========================================

/** Non-deleted users holding a role assignment in the business. */
const adminsOfBusiness = (businessId: bigint): Prisma.UsersWhereInput => ({
  deletedAt: null,
  userHasRoles: { some: { businessId } },
});

const adminNotFoundError = () =>
  new AppError("Administrator not found", 404, "ADMIN_NOT_FOUND");

const emailTakenError = () =>
  new AppError("Email address is already in use", 409, "EMAIL_TAKEN", [
    { field: "email", message: "Email address is already in use" },
  ]);

interface ManagedAdmin {
  id: string;
  status: UserStatus;
  roles: { id: bigint; name: string }[];
}

const findManagedAdmin = async (
  adminId: string,
  businessId: bigint,
): Promise<ManagedAdmin> => {
  const admin = await prisma.users.findFirst({
    where: { id: adminId, ...adminsOfBusiness(businessId) },
    select: {
      id: true,
      status: true,
      userHasRoles: {
        where: { businessId, roleId: { not: null } },
        select: { role: { select: { id: true, name: true } } },
      },
    },
  });
  if (!admin) throw adminNotFoundError();

  return {
    id: admin.id,
    status: admin.status,
    roles: admin.userHasRoles.flatMap(({ role }) => (role ? [role] : [])),
  };
};

/**
 * Staff cannot change their own role, status or account, and nobody but
 * the manager themselves can change the business manager's account.
 */
const assertCanManage = (
  target: ManagedAdmin,
  actor: AdminActor,
  { allowSelf }: { allowSelf: boolean },
): void => {
  const isSelf = target.id === actor.userId;

  if (isSelf && !allowSelf) {
    throw new AppError(
      "You cannot change your own role, status or account",
      403,
      "CANNOT_MANAGE_SELF",
    );
  }
  if (!isSelf && target.roles.some(({ name }) => name === MANAGER_ROLE_NAME)) {
    throw new AppError(
      "The business manager's account cannot be changed",
      403,
      "MANAGER_PROTECTED",
    );
  }
};

/**
 * Check that every role exists for the actor's business, none is the
 * manager role, and together they grant nothing the actor does not hold.
 */
const assertRolesAssignable = async (
  roleIds: bigint[],
  actor: AdminActor,
): Promise<void> => {
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, ...rolesVisibleTo(actor.businessId) },
    select: { id: true, name: true, permissions: { select: { permissionId: true } } },
  });

  const foundIds = new Set(roles.map(({ id }) => id));
  const missing = roleIds.filter((id) => !foundIds.has(id));
  if (missing.length) {
    throw new AppError(
      "Role not found",
      400,
      "INVALID_ROLE",
      missing.map((id) => ({ field: "roleIds", message: `Role ${id} does not exist` })),
    );
  }
  if (roles.some(({ name }) => name === MANAGER_ROLE_NAME)) {
    throw new AppError(
      "The manager role cannot be assigned",
      403,
      "MANAGER_ROLE_NOT_ASSIGNABLE",
    );
  }

  const grantedPermissionIds = new Set(
    roles.flatMap(({ permissions }) => permissions.map(({ permissionId }) => permissionId)),
  );
  await assertActorHoldsPermissions(actor, [...grantedPermissionIds], "roleIds");
};

/**
 * Make the administrator hold exactly these roles in the business. With no
 * roles left they keep a role-less assignment, since assignments are what
 * place an administrator in a business.
 */
const replaceRoles = async (
  tx: Prisma.TransactionClient,
  adminId: string,
  businessId: bigint,
  roleIds: bigint[],
): Promise<void> => {
  await tx.userHasRole.deleteMany({ where: { userId: adminId, businessId } });
  await tx.userHasRole.createMany({
    data: (roleIds.length ? roleIds : [null]).map((roleId) => ({
      userId: adminId,
      roleId,
      businessId,
    })),
  });
};

const assertEmailAvailable = async (email: string, exceptAdminId?: string) => {
  const existing = await prisma.users.findFirst({
    where: {
      email,
      ...(exceptAdminId && { id: { not: exceptAdminId } }),
    },
    select: { id: true },
  });
  if (existing) throw emailTakenError();
};

const getAdminRecord = async (
  db: Prisma.TransactionClient,
  adminId: string,
  businessId: bigint,
): Promise<AdminPublicRecord> =>
  toAdminRecord(
    await db.users.findUniqueOrThrow({
      where: { id: adminId },
      select: adminPublicSelect(businessId),
    }),
  );

/**
 * Write a status change only if the status is still the one we read,
 * so a concurrent change surfaces as a 409 instead of being overwritten.
 */
const applyStatusChange = async (
  tx: Prisma.TransactionClient,
  adminId: string,
  expectedStatus: UserStatus,
  data: Prisma.UsersUpdateManyMutationInput,
): Promise<void> => {
  const { count } = await tx.users.updateMany({
    where: { id: adminId, status: expectedStatus, deletedAt: null },
    data,
  });

  if (count === 0) {
    throw new AppError(
      "Administrator status was changed by another request. Please retry.",
      409,
      "STATUS_CHANGED_CONCURRENTLY",
    );
  }
};

const revokeTokens = (tx: Prisma.TransactionClient, adminId: string) =>
  tx.userTokens.updateMany({
    where: { userId: adminId, revoked: false },
    data: { revoked: true },
  });

const notFoundOnMissingRecord = (error: unknown): unknown =>
  isPrismaErrorCode(error, "P2025") ? adminNotFoundError() : error;

// ==========================================
// Read
// ==========================================

/**
 * List a business's administrators. Filters are combined with AND.
 */
export const listAdmins = async (businessId: bigint, query: ListAdminsQuery) => {
  const { page, limit, role, status, name, email, search } = query;

  const nameWords = name?.split(/\s+/) ?? [];
  const where: Prisma.UsersWhereInput = {
    deletedAt: null,
    userHasRoles: {
      some: {
        businessId,
        ...(role && { role: { name: { equals: role, mode: "insensitive" } } }),
      },
    },
    ...(status && { status }),
    ...(email && { email: { contains: email, mode: "insensitive" } }),
    AND: [
      // Every word of the name must match the first or last name
      ...nameWords.map((word) => ({
        OR: [
          { firstName: { contains: word, mode: "insensitive" as const } },
          { lastName: { contains: word, mode: "insensitive" as const } },
        ],
      })),
      ...(search
        ? [
            {
              OR: [
                { email: { contains: search, mode: "insensitive" as const } },
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  const [users, total] = await Promise.all([
    prisma.users.findMany({
      where,
      select: adminPublicSelect(businessId),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.users.count({ where }),
  ]);

  return {
    // userHasRoles is kept alongside role for clients of the earlier response shape
    users: users.map((user) => ({
      ...toAdminRecord(user),
      userHasRoles: user.userHasRoles,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getAdminById = async (
  adminId: string,
  businessId: bigint,
): Promise<AdminPublicRecord> => {
  const admin = await prisma.users.findFirst({
    where: { id: adminId, ...adminsOfBusiness(businessId) },
    select: adminPublicSelect(businessId),
  });
  if (!admin) throw adminNotFoundError();

  return toAdminRecord(admin);
};

/**
 * Get user by ID, including the password hash (used for password checks)
 */
export const getUserByUniqueId = async (
  id: string,
): Promise<IUserResponse | null> => {
  try {
    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        status: true,
        updatedAt: true,
        password: true,
        passwordExpiresAt: true,
        failedLoginCount: true,
        totpEnabled: true,
      },
    });
    return user;
  } catch (error) {
    throw new ApiError(500, "Failed to fetch user");
  }
};

// ==========================================
// Create / update / delete
// ==========================================

/**
 * Create an administrator in the actor's business with one or more roles.
 * The account, its roles, business link, password history, temporary
 * password email and audit entry are written in one transaction.
 */
export const createAdmin = async (
  input: CreateAdminInput,
  actor: AdminActor,
): Promise<AdminPublicRecord> => {
  const { roleIds, ...profile } = input;

  await assertRolesAssignable(roleIds, actor);
  await assertEmailAvailable(profile.email);

  const temporaryPassword = TempPasswordTokenManager.generateToken();
  const hashedPassword = await bcrypt.hash(temporaryPassword, saltRounds);
  const now = getCurrentTimestamp();

  try {
    return await prisma.$transaction(async (tx) => {
      const admin = await tx.users.create({
        data: {
          ...profile,
          password: hashedPassword,
          passwordCreatedAt: now,
          passwordExpiresAt: addDays(now, PASSWORD_LIFETIME_DAYS),
          mustChangePassword: true,
          createdBy: actor.userId,
          userHasRoles: {
            createMany: {
              data: roleIds.map((roleId) => ({ roleId, businessId: actor.businessId })),
            },
          },
          businesses: { create: { businessId: actor.businessId } },
          passwordHistories: {
            create: { password: hashedPassword, passwordstatus: "password-change" },
          },
        },
        select: adminPublicSelect(actor.businessId),
      });

      await tx.notifications.create({
        data: NotificationModel.buildTempPasswordNotification({
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          generatedPassword: temporaryPassword,
          resetLink: `${process.env.MUST_CHANGE_PASSWORD_LINK_URL}/change-password?email=${admin.email}`,
        }),
      });
      await AuditModel.logAdminCreated(actor, admin.id, roleIds, tx);

      return toAdminRecord(admin);
    });
  } catch (error) {
    // Lost a race with a concurrent request using the same email
    if (isPrismaErrorCode(error, "P2002")) throw emailTakenError();
    throw error;
  }
};

/**
 * Apply detail and/or role changes to a looked-up administrator. roleIds is
 * the complete set they should hold. Staff may edit their own details but
 * not their own roles. Only newly added roles go through the assignability
 * checks, so an actor can still remove a role that grants more than they hold.
 */
const applyAdminUpdate = async (
  target: ManagedAdmin,
  input: UpdateAdminInput,
  actor: AdminActor,
): Promise<AdminPublicRecord> => {
  const { roleIds, ...profile } = input;
  const adminId = target.id;

  const currentIds = target.roles.map(({ id }) => id);
  const added = roleIds?.filter((id) => !currentIds.includes(id)) ?? [];
  const removed = roleIds ? currentIds.filter((id) => !roleIds.includes(id)) : [];
  const rolesChange = added.length > 0 || removed.length > 0;

  assertCanManage(target, actor, { allowSelf: !rolesChange });

  if (added.length) await assertRolesAssignable(added, actor);
  if (profile.email) await assertEmailAvailable(profile.email, adminId);

  try {
    return await prisma.$transaction(async (tx) => {
      // Also runs with no detail changes, so a concurrent delete surfaces as a 404
      await tx.users.update({ where: { id: adminId, deletedAt: null }, data: profile });
      if (rolesChange) await replaceRoles(tx, adminId, actor.businessId, roleIds!);

      const updatedFields = Object.keys(profile);
      if (updatedFields.length) {
        await AuditModel.logAdminUpdated(actor, adminId, updatedFields, tx);
      }
      if (rolesChange) {
        await AuditModel.logAdminRolesChanged(actor, adminId, added, removed, tx);
      }

      return getAdminRecord(tx, adminId, actor.businessId);
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw emailTakenError();
    throw notFoundOnMissingRecord(error);
  }
};

/** Update an administrator's details and/or replace their set of roles. */
export const updateAdmin = async (
  adminId: string,
  input: UpdateAdminInput,
  actor: AdminActor,
): Promise<AdminPublicRecord> =>
  applyAdminUpdate(await findManagedAdmin(adminId, actor.businessId), input, actor);

/** Add roles to the ones an administrator already holds (legacy "assign"). */
export const assignAdminRoles = async (
  adminId: string,
  roleIds: bigint[],
  actor: AdminActor,
): Promise<AdminPublicRecord> => {
  const target = await findManagedAdmin(adminId, actor.businessId);
  const currentIds = target.roles.map(({ id }) => id);

  return applyAdminUpdate(target, { roleIds: [...new Set([...currentIds, ...roleIds])] }, actor);
};

/**
 * Remove the given roles from an administrator, or all of them when none
 * are given, keeping them in the business (legacy "unassign").
 */
export const unassignAdminRoles = async (
  adminId: string,
  roleIds: bigint[] | undefined,
  actor: AdminActor,
): Promise<AdminPublicRecord> => {
  const target = await findManagedAdmin(adminId, actor.businessId);
  const remaining = roleIds
    ? target.roles.map(({ id }) => id).filter((id) => !roleIds.includes(id))
    : [];

  return applyAdminUpdate(target, { roleIds: remaining }, actor);
};

/**
 * Soft delete an administrator and revoke their sessions. The row keeps
 * its unique email, so that address cannot be reused afterwards.
 */
export const deleteAdmin = async (
  adminId: string,
  actor: AdminActor,
): Promise<void> => {
  const target = await findManagedAdmin(adminId, actor.businessId);
  assertCanManage(target, actor, { allowSelf: false });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: adminId, deletedAt: null },
        data: { deletedAt: getCurrentTimestamp() },
      });
      await revokeTokens(tx, adminId);
      await AuditModel.logAdminDeleted(actor, adminId, tx);
    });
  } catch (error) {
    throw notFoundOnMissingRecord(error);
  }
};

// ==========================================
// Status
// ==========================================

// Leave can be granted to active staff, or updated while already on leave
const LEAVE_ELIGIBLE_STATUSES: UserStatus[] = ["active", "on_leave"];
// Statuses an administrator is brought back from by unblocking
const REACTIVATABLE_STATUSES: UserStatus[] = ["blocked", "blocked_by_admin", "on_leave"];

export interface AdminStatusChangeResult {
  admin: AdminPublicRecord;
  changed: boolean;
}

/**
 * Block an administrator or place them on leave. Either way their
 * sessions are revoked, and login is refused until they are reactivated.
 * A block is stored as blocked_by_admin, which (unlike an automatic
 * "blocked") a password reset cannot clear. Blocking an administrator
 * already blocked by an admin is a no-op; one blocked automatically is
 * upgraded to an admin block.
 */
export const updateAdminStatus = async (
  adminId: string,
  input: UpdateAdminStatusInput,
  actor: AdminActor,
): Promise<AdminStatusChangeResult> => {
  const target = await findManagedAdmin(adminId, actor.businessId);
  assertCanManage(target, actor, { allowSelf: false });

  let data: Prisma.UsersUpdateManyMutationInput;

  if (input.status === "blocked") {
    if (target.status === "blocked_by_admin") {
      return { admin: await getAdminById(adminId, actor.businessId), changed: false };
    }
    data = {
      status: "blocked_by_admin",
      blockReason: input.reason ?? null,
      leaveReason: null,
      expectedReturnDate: null,
    };
  } else {
    if (!LEAVE_ELIGIBLE_STATUSES.includes(target.status)) {
      throw new AppError(
        `An administrator with status "${target.status}" cannot be placed on leave`,
        409,
        "INVALID_STATUS_TRANSITION",
      );
    }
    data = {
      status: "on_leave",
      leaveReason: input.reason,
      expectedReturnDate: input.expectedReturnDate,
      blockReason: null,
    };
  }

  const admin = await prisma.$transaction(async (tx) => {
    await applyStatusChange(tx, adminId, target.status, data);
    await revokeTokens(tx, adminId);
    await AuditModel.logAdminStatusChanged(actor, adminId, data.status as UserStatus, input.reason, tx);
    return getAdminRecord(tx, adminId, actor.businessId);
  });

  return { admin, changed: true };
};

/**
 * Reactivate a blocked or on-leave administrator, clearing the block and
 * leave details and the failed-login counter (otherwise the next failed
 * login would immediately re-block them). Any other status is left alone.
 */
export const reactivateAdmin = async (
  adminId: string,
  actor: AdminActor,
): Promise<AdminStatusChangeResult> => {
  const target = await findManagedAdmin(adminId, actor.businessId);
  assertCanManage(target, actor, { allowSelf: false });

  if (!REACTIVATABLE_STATUSES.includes(target.status)) {
    return { admin: await getAdminById(adminId, actor.businessId), changed: false };
  }

  const admin = await prisma.$transaction(async (tx) => {
    await applyStatusChange(tx, adminId, target.status, {
      status: "active",
      blockReason: null,
      leaveReason: null,
      expectedReturnDate: null,
      failedLoginCount: 0,
    });
    await AuditModel.logAdminStatusChanged(actor, adminId, "active", undefined, tx);
    return getAdminRecord(tx, adminId, actor.businessId);
  });

  return { admin, changed: true };
};

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
  roleId: bigint | null;
  roleName: string | null;
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
        take: 1,
      },
    },
  });
  if (!admin) throw adminNotFoundError();

  const role = admin.userHasRoles[0]?.role ?? null;
  return {
    id: admin.id,
    status: admin.status,
    roleId: role?.id ?? null,
    roleName: role?.name ?? null,
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
  if (!isSelf && target.roleName === MANAGER_ROLE_NAME) {
    throw new AppError(
      "The business manager's account cannot be changed",
      403,
      "MANAGER_PROTECTED",
    );
  }
};

/**
 * Check that a role exists for the actor's business, is not the manager
 * role, and grants nothing the actor does not hold.
 */
const assertRoleAssignable = async (
  roleId: bigint,
  actor: AdminActor,
): Promise<void> => {
  const role = await prisma.role.findFirst({
    where: { id: roleId, ...rolesVisibleTo(actor.businessId) },
    select: { name: true, permissions: { select: { permissionId: true } } },
  });

  if (!role) {
    throw new AppError("Role not found", 400, "INVALID_ROLE", [
      { field: "roleId", message: `Role ${roleId} does not exist` },
    ]);
  }
  if (role.name === MANAGER_ROLE_NAME) {
    throw new AppError(
      "The manager role cannot be assigned",
      403,
      "MANAGER_ROLE_NOT_ASSIGNABLE",
    );
  }

  await assertActorHoldsPermissions(
    actor,
    role.permissions.map(({ permissionId }) => permissionId),
    "roleId",
  );
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
 * Create an administrator in the actor's business with exactly one role.
 * The account, its role, business link, password history, temporary
 * password email and audit entry are written in one transaction.
 */
export const createAdmin = async (
  input: CreateAdminInput,
  actor: AdminActor,
): Promise<AdminPublicRecord> => {
  const { roleId, ...profile } = input;

  await assertRoleAssignable(roleId, actor);
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
          userHasRoles: { create: { roleId, businessId: actor.businessId } },
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
      await AuditModel.logAdminCreated(actor, admin.id, roleId, tx);

      return toAdminRecord(admin);
    });
  } catch (error) {
    // Lost a race with a concurrent request using the same email
    if (isPrismaErrorCode(error, "P2002")) throw emailTakenError();
    throw error;
  }
};

/**
 * Update an administrator's details and/or role. A new role replaces the
 * previous one. Staff may edit their own details but not their own role.
 */
export const updateAdmin = async (
  adminId: string,
  input: UpdateAdminInput,
  actor: AdminActor,
): Promise<AdminPublicRecord> => {
  const { roleId, ...profile } = input;
  const target = await findManagedAdmin(adminId, actor.businessId);
  const roleChanges = roleId !== undefined && roleId !== target.roleId;

  assertCanManage(target, actor, { allowSelf: !roleChanges });

  if (roleChanges) await assertRoleAssignable(roleId, actor);
  if (profile.email) await assertEmailAvailable(profile.email, adminId);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: adminId, deletedAt: null },
        data: {
          ...profile,
          ...(roleChanges && {
            userHasRoles: {
              deleteMany: { businessId: actor.businessId },
              create: { roleId, businessId: actor.businessId },
            },
          }),
        },
      });

      const updatedFields = Object.keys(profile);
      if (updatedFields.length) {
        await AuditModel.logAdminUpdated(actor, adminId, updatedFields, tx);
      }
      if (roleChanges) {
        await AuditModel.logAdminRoleChanged(actor, adminId, roleId, tx);
      }

      return getAdminRecord(tx, adminId, actor.businessId);
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw emailTakenError();
    throw notFoundOnMissingRecord(error);
  }
};

/**
 * Remove an administrator's role in the actor's business, keeping them
 * in the business without one (used by the legacy assign/unassign endpoint).
 */
export const unassignAdminRole = async (
  adminId: string,
  actor: AdminActor,
): Promise<void> => {
  const target = await findManagedAdmin(adminId, actor.businessId);
  assertCanManage(target, actor, { allowSelf: false });

  if (target.roleId === null) return;

  await prisma.$transaction(async (tx) => {
    await tx.userHasRole.updateMany({
      where: { userId: adminId, businessId: actor.businessId },
      data: { roleId: null },
    });
    await AuditModel.logAdminRoleChanged(actor, adminId, null, tx);
  });
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
const REACTIVATABLE_STATUSES: UserStatus[] = ["blocked", "on_leave"];

export interface AdminStatusChangeResult {
  admin: AdminPublicRecord;
  changed: boolean;
}

/**
 * Block an administrator or place them on leave. Either way their
 * sessions are revoked, and login is refused until they are reactivated.
 * Blocking an already blocked administrator is a no-op.
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
    if (target.status === "blocked") {
      return { admin: await getAdminById(adminId, actor.businessId), changed: false };
    }
    data = {
      status: "blocked",
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
    await AuditModel.logAdminStatusChanged(actor, adminId, input.status, input.reason, tx);
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

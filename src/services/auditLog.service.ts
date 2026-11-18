import { Prisma } from "@prisma/client";

import prisma from "../config/database";
import { AdminActor } from "../interfaces/admin.interfaces";
import { AuditModel } from "../models/audit.model";
import {
  ListAdminsAuditLogsQuery,
  ListAuditLogsQuery,
  ListGuardiansAuditLogsQuery,
  ListOwnAuditLogsQuery,
  ListStudentsAuditLogsQuery,
} from "../validations/auditLog.schema";

const auditLogSelect = {
  id: true,
  createdAt: true,
  result: true,
  status: true,
  ipAddress: true,
  businessId: true,
  actorType: true,
  action: true,
  targetType: true,
  targetId: true,
  userId: true,
  studentId: true,
  guardianId: true,
  userAgent: true,
  httpMethod: true,
  path: true,
  requestId: true,
  metadata: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  students: {
    select: { id: true, firstName: true, lastName: true, registrationNumber: true },
  },
  guardians: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.AuditLogsSelect;

/**
 * A guardian belongs to a business directly, or (when businessId was never
 * set on the guardian) through any of their children.
 */
const guardianInBusiness = (businessId: bigint): Prisma.GuardiansWhereInput => ({
  OR: [
    { businessId },
    { businessId: null, students: { some: { students: { businessId } } } },
  ],
});

/**
 * Every log row belonging to a business. user-service still writes student and
 * guardian rows without businessId, so those are matched through the account.
 * Administrator rows are matched on businessId only: admin-service now always
 * records it, the backfill migration filled it in on older rows, and a row still
 * without one belongs to an administrator in several businesses, so it cannot
 * be shown to any one school without risking showing it to the wrong one.
 */
const belongsToBusiness = (businessId: bigint): Prisma.AuditLogsWhereInput => ({
  OR: [
    { businessId },
    { businessId: null, students: { businessId } },
    { businessId: null, guardians: guardianInBusiness(businessId) },
  ],
});

const commonFilters = (
  query: ListOwnAuditLogsQuery,
): Prisma.AuditLogsWhereInput[] => [
  ...(query.result ? [{ result: query.result }] : []),
  // Exact code (student.blocked), or a whole area (auth.*)
  ...(query.action
    ? [
        query.action.endsWith(".*")
          ? { action: { startsWith: query.action.slice(0, -1) } }
          : { action: query.action },
      ]
    : []),
  ...(query.from || query.to
    ? [{ createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }]
    : []),
];

// actor_type records who acted, so "admin blocked student 9" is the admin's
// action and "student 9 logged in" is the student's
const actorTypeFilter = (
  actorType: ListAuditLogsQuery["actorType"],
): Prisma.AuditLogsWhereInput[] => (actorType ? [{ actorType }] : []);

const fetchPage = async (
  where: Prisma.AuditLogsWhereInput,
  page: number,
  limit: number,
) => {
  const [logs, total] = await Promise.all([
    prisma.auditLogs.findMany({
      where,
      select: auditLogSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLogs.count({ where }),
  ]);

  return {
    logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Audit logs for everyone in the actor's business: administrators, students
 * and guardians. The business always comes from the actor's token, so another
 * business's logs can never be requested.
 */
export const listBusinessAuditLogs = async (
  actor: AdminActor,
  query: ListAuditLogsQuery,
) => {
  const where: Prisma.AuditLogsWhereInput = {
    AND: [
      belongsToBusiness(actor.businessId),
      ...actorTypeFilter(query.actorType),
      ...commonFilters(query),
    ],
  };

  const result = await fetchPage(where, query.page, query.limit);
  await AuditModel.logAuditLogsViewed(actor.userId, actor.ip, actor.businessId);
  return result;
};

/**
 * What administrators in the actor's business did: one administrator when
 * userId is given, otherwise all of them.
 */
export const listAdminsAuditLogs = async (
  actor: AdminActor,
  query: ListAdminsAuditLogsQuery,
) => {
  const where: Prisma.AuditLogsWhereInput = {
    AND: [
      belongsToBusiness(actor.businessId),
      { actorType: "admin", ...(query.userId && { userId: query.userId }) },
      ...commonFilters(query),
    ],
  };

  const result = await fetchPage(where, query.page, query.limit);
  await AuditModel.logAuditLogsViewed(actor.userId, actor.ip, actor.businessId);
  return result;
};

/**
 * Rows for students or guardians. By default only what they did themselves.
 * With include=received, also every row naming them, such as an administrator
 * blocking a student or a guardian editing their child's permissions.
 */
const accountFilter = (
  kind: "student" | "guardian",
  id: bigint | undefined,
  include: "received" | undefined,
): Prisma.AuditLogsWhereInput => {
  const idColumn = kind === "student" ? "studentId" : "guardianId";
  const actedThemselves: Prisma.AuditLogsWhereInput = { actorType: kind };

  if (id !== undefined) {
    return include === "received"
      ? { [idColumn]: id }
      : { [idColumn]: id, ...actedThemselves };
  }

  return include === "received"
    ? { OR: [actedThemselves, { [idColumn]: { not: null } }] }
    : actedThemselves;
};

/**
 * What students in the actor's business did: one student when studentId is
 * given, otherwise all of them.
 */
export const listStudentsAuditLogs = async (
  actor: AdminActor,
  query: ListStudentsAuditLogsQuery,
) => {
  const where: Prisma.AuditLogsWhereInput = {
    AND: [
      belongsToBusiness(actor.businessId),
      accountFilter("student", query.studentId, query.include),
      ...commonFilters(query),
    ],
  };

  const result = await fetchPage(where, query.page, query.limit);
  await AuditModel.logAuditLogsViewed(actor.userId, actor.ip, actor.businessId);
  return result;
};

/**
 * What guardians in the actor's business did: one guardian when guardianId is
 * given, otherwise all of them.
 */
export const listGuardiansAuditLogs = async (
  actor: AdminActor,
  query: ListGuardiansAuditLogsQuery,
) => {
  const where: Prisma.AuditLogsWhereInput = {
    AND: [
      belongsToBusiness(actor.businessId),
      accountFilter("guardian", query.guardianId, query.include),
      ...commonFilters(query),
    ],
  };

  const result = await fetchPage(where, query.page, query.limit);
  await AuditModel.logAuditLogsViewed(actor.userId, actor.ip, actor.businessId);
  return result;
};

/** The actor's own activity within their business. */
export const listOwnAuditLogs = async (
  actor: AdminActor,
  query: ListOwnAuditLogsQuery,
) => {
  const where: Prisma.AuditLogsWhereInput = {
    AND: [
      belongsToBusiness(actor.businessId),
      { userId: actor.userId, actorType: "admin" },
      ...commonFilters(query),
    ],
  };

  return fetchPage(where, query.page, query.limit);
};

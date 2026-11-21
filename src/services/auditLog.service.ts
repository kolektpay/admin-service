import { Prisma } from "@prisma/client";

import prisma from "../config/database";
import { AdminActor } from "../interfaces/admin.interfaces";
import { AuditModel } from "../models/audit.model";
import { auditLogSelect, presentAuditLogs } from "./auditLogPresenter";
import {
  ListAdminsAuditLogsQuery,
  ListAuditLogsQuery,
  ListGuardiansAuditLogsQuery,
  ListOwnAuditLogsQuery,
  ListStudentsAuditLogsQuery,
} from "../validations/auditLog.schema";

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

const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

/** Every word must appear in one of the fields, so "john john" finds John Johnson. */
const personMatches = <F extends string>(words: string[], fields: F[]) => ({
  AND: words.map((word) => ({ OR: fields.map((field) => ({ [field]: contains(word) })) })),
});

const MAX_SEARCH_TARGET_IDS = 500;

/**
 * The search box matches the actor's or the target's name. Students and
 * guardians are on the row itself; administrators, roles and subclasses acted
 * on are looked up first and matched by id. The row's description is also
 * searched, which covers roles and subclasses since deleted.
 */
const searchFilter = async (
  search: string | undefined,
  businessId: bigint,
): Promise<Prisma.AuditLogsWhereInput[]> => {
  const words = search?.split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return [];

  const [admins, roles, subclasses] = await Promise.all([
    prisma.users.findMany({
      where: {
        businesses: { some: { businessId } },
        ...personMatches(words, ["firstName", "lastName", "email"]),
      },
      select: { id: true },
      take: MAX_SEARCH_TARGET_IDS,
    }),
    prisma.role.findMany({
      where: { OR: [{ businessId }, { businessId: null }], name: contains(search!.trim()) },
      select: { id: true },
      take: MAX_SEARCH_TARGET_IDS,
    }),
    prisma.subclasses.findMany({
      where: { businessId, ...personMatches(words, ["name"]) },
      select: { id: true },
      take: MAX_SEARCH_TARGET_IDS,
    }),
  ]);

  const adminIds = admins.map(({ id }) => id);
  const targets = (type: string, ids: string[]) =>
    ids.length ? [{ targetType: type, targetId: { in: ids } }] : [];

  return [
    {
      OR: [
        { user: personMatches(words, ["firstName", "lastName", "email"]) },
        { students: personMatches(words, ["firstName", "lastName", "registrationNumber"]) },
        { guardians: personMatches(words, ["firstName", "lastName"]) },
        ...targets("admin", adminIds),
        ...targets("role", roles.map(({ id }) => String(id))),
        ...targets("subclass", subclasses.map(({ id }) => String(id))),
        { status: contains(search!.trim()) },
        { ipAddress: { startsWith: search!.trim() } },
      ],
    },
  ];
};

const commonFilters = async (
  query: ListOwnAuditLogsQuery,
  businessId: bigint,
): Promise<Prisma.AuditLogsWhereInput[]> => [
  ...(await searchFilter(query.search, businessId)),
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
  businessId: bigint,
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
    logs: await presentAuditLogs(logs, businessId),
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
      ...(await commonFilters(query, actor.businessId)),
    ],
  };

  const result = await fetchPage(where, query.page, query.limit, actor.businessId);
  await AuditModel.logAuditLogsViewed(actor.userId, actor.ip, actor.businessId);
  return result;
};

/**
 * What administrators in the actor's business did: one administrator when
 * userId is given, otherwise all of them. Actions on a student or guardian are
 * left out, since the Student and Guardian tabs show them; GET /audit-logs
 * with actorType=admin returns everything administrators did.
 */
export const listAdminsAuditLogs = async (
  actor: AdminActor,
  query: ListAdminsAuditLogsQuery,
) => {
  const where: Prisma.AuditLogsWhereInput = {
    AND: [
      belongsToBusiness(actor.businessId),
      {
        actorType: "admin",
        studentId: null,
        guardianId: null,
        ...(query.userId && { userId: query.userId }),
      },
      ...(await commonFilters(query, actor.businessId)),
    ],
  };

  const result = await fetchPage(where, query.page, query.limit, actor.businessId);
  await AuditModel.logAuditLogsViewed(actor.userId, actor.ip, actor.businessId);
  return result;
};

/**
 * Rows for students or guardians. By default (scope=all) what they did and
 * every row naming them, such as an administrator blocking a student or a
 * guardian editing their child's permissions. scope=own is only what they did.
 */
const accountFilter = (
  kind: "student" | "guardian",
  id: bigint | undefined,
  scope: "all" | "own",
): Prisma.AuditLogsWhereInput => {
  const idColumn = kind === "student" ? "studentId" : "guardianId";
  const actedThemselves: Prisma.AuditLogsWhereInput = { actorType: kind };

  if (id !== undefined) {
    return scope === "all"
      ? { [idColumn]: id }
      : { [idColumn]: id, ...actedThemselves };
  }

  return scope === "all"
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
      accountFilter("student", query.studentId, query.scope),
      ...(await commonFilters(query, actor.businessId)),
    ],
  };

  const result = await fetchPage(where, query.page, query.limit, actor.businessId);
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
      accountFilter("guardian", query.guardianId, query.scope),
      ...(await commonFilters(query, actor.businessId)),
    ],
  };

  const result = await fetchPage(where, query.page, query.limit, actor.businessId);
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
      ...(await commonFilters(query, actor.businessId)),
    ],
  };

  return fetchPage(where, query.page, query.limit, actor.businessId);
};

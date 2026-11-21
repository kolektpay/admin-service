import { AuditActorType, AuditLoginResult, Prisma } from "@prisma/client";

import prisma from "../config/database";
import { AuditAction } from "../constants/auditActions";

/**
 * Turns raw audit rows into what the Audit Logs screen shows on each line:
 * who acted, what they did, what they did it to, when, and whether it worked.
 */

export const auditLogSelect = {
  id: true,
  createdAt: true,
  result: true,
  status: true,
  ipAddress: true,
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

export type AuditLogRow = Prisma.AuditLogsGetPayload<{ select: typeof auditLogSelect }>;

export type AuditLogStatus = "success" | "failed" | "blocked";

export interface AuditLogEntry {
  id: bigint;
  createdAt: Date;
  actor: {
    type: AuditActorType;
    /** uuid for an administrator, numeric id for a student or guardian */
    id: string | null;
    /** e.g. "Jane Smith", or "Unknown (102.89.1.4)" for a sign-in to no account */
    name: string;
    /** The administrator's role(s) in this business, e.g. "Finance Manager" */
    role: string | null;
  };
  action: {
    /** Fixed code for filtering, e.g. role.created */
    code: string;
    /** e.g. "Created Role" */
    label: string;
  };
  target: {
    /** student, guardian, admin, role, subclass, or the area acted on (system, wallet, ...) */
    type: string;
    id: string | null;
    /** e.g. "Finance Manager", "Alice Johnson", "System", "Guardian Portal" */
    name: string;
  } | null;
  status: AuditLogStatus;
  statusLabel: "Success" | "Failed" | "Blocked";
  /** For a detail view; not needed for the table */
  details: {
    description: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    httpMethod: string | null;
    path: string | null;
    requestId: string | null;
    metadata: Prisma.JsonValue;
  };
}

const ACTION_LABELS: Record<AuditAction, string> = {
  "auth.login_succeeded": "Login",
  "auth.login_failed": "Failed Login",
  "auth.login_rejected_blocked": "Blocked Login",
  "auth.logout": "Logout",
  "auth.account_locked": "Account Locked",
  "auth.account_unlocked": "Account Unlocked",
  "auth.password_changed": "Changed Password",
  "auth.password_forgot_requested": "Requested Password Reset",
  "auth.password_reset": "Reset Password",
  "auth.temporary_password_changed": "Changed Temporary Password",
  "auth.password_rotation_enforced": "Password Expired",
  "auth.two_factor_setup": "Set Up 2FA",
  "auth.two_factor_enabled": "Enabled 2FA",

  "audit_logs.viewed": "Viewed Audit Logs",

  "admin.listed": "Viewed Admins",
  "admin.viewed": "Viewed Admin",
  "admin.created": "Created Admin",
  "admin.updated": "Updated Admin",
  "admin.deleted": "Deleted Admin",
  "admin.role_assigned": "Assigned Role",
  "admin.roles_changed": "Changed Admin Roles",
  "admin.status_changed": "Changed Admin Status",
  "role.created": "Created Role",
  "role.deleted": "Deleted Role",
  "role.permissions_updated": "Updated Role Permissions",

  "manager.created": "Created Manager",
  "business.created": "Created Business",
  "business.bank_added": "Added Bank Account",
  "business.banks_listed": "Viewed Bank Accounts",
  "business.bank_deleted": "Deleted Bank Account",
  "business.bank_activated": "Activated Bank Account",
  "business.active_bank_viewed": "Viewed Active Bank Account",

  "wallet.details_viewed": "Viewed Wallet",
  "wallet.student_wallet_created": "Created Student Wallet",
  "wallet.pin_set": "Set Wallet PIN",
  "payment_link.generated": "Generated Payment Link",
  "payment_link.listed": "Viewed Payment Links",
  "payment_item.created": "Created Payment Item",
  "payment_item.approved": "Approved Payment Item",

  "student.created": "Created Student",
  "student.updated": "Updated Student",
  "student.deleted": "Deleted Student",
  "student.blocked": "Blocked Student",
  "student.unblocked": "Unblocked Student",
  "guardian.created": "Created Guardian",
  "guardian.updated": "Updated Guardian",
  "guardian.deleted": "Deleted Guardian",
  "guardian.student_permissions_updated": "Updated Guardian Permissions",

  "class.created": "Created Class",
  "class.updated": "Updated Class",
  "class.deleted": "Deleted Class",
  "subclass.created": "Created Subclass",
  "subclass.updated": "Updated Subclass",
  "subclass.deleted": "Deleted Subclass",
  "student.subclass_assigned": "Updated Class",
  "student.subclass_unassigned": "Removed From Class",
  "students.assigned": "Assigned Students",
  "students.transferred": "Transferred Students",

  "invoice.listed": "Viewed Invoices",

  "request.get": "Viewed",
  "request.post": "Submitted",
  "request.put": "Updated",
  "request.patch": "Updated",
  "request.delete": "Deleted",

  "legacy.unmapped": "Other Activity",
};

const ADMIN_STATUS_LABELS: Record<string, string> = {
  blocked: "Blocked Admin",
  blocked_by_admin: "Blocked Admin",
  active: "Activated Admin",
  inactive: "Deactivated Admin",
  on_leave: "Placed Admin On Leave",
};

/** "guardian.student_permissions_updated" -> "Student Permissions Updated" */
const humanize = (code: string): string =>
  (code.split(".").pop() ?? code)
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

const metadataField = (metadata: Prisma.JsonValue, key: string): string | undefined => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const value = (metadata as Prisma.JsonObject)[key];
  return typeof value === "string" ? value : undefined;
};

const actionLabel = (row: AuditLogRow, code: string): string => {
  if (code === "admin.status_changed") {
    const newStatus =
      metadataField(row.metadata, "newStatus") ?? row.status?.match(/ to (\w+)/)?.[1];
    if (newStatus && ADMIN_STATUS_LABELS[newStatus]) return ADMIN_STATUS_LABELS[newStatus];
  }
  return ACTION_LABELS[code as AuditAction] ?? humanize(code);
};

/**
 * Blocking a student is a successful action even though the row's result is
 * "blocked"; only a sign-in turned away is shown as Blocked.
 */
const displayStatus = (result: AuditLoginResult, code: string): AuditLogStatus => {
  if (result === "failure") return "failed";
  if (result === "blocked" && code.startsWith("auth.")) return "blocked";
  return "success";
};

const STATUS_LABELS = { success: "Success", failed: "Failed", blocked: "Blocked" } as const;

const fullName = (person: { firstName: string; lastName: string } | null) =>
  person ? `${person.firstName} ${person.lastName}`.trim() : null;

const actorTypeOf = (row: AuditLogRow): AuditActorType => {
  if (row.actorType) return row.actorType;
  if (row.userId) return "admin";
  if (row.guardianId !== null) return "guardian";
  if (row.studentId !== null) return "student";
  return "anonymous";
};

// Rows written before targets were recorded name them in status only
const LEGACY_ADMIN_TARGET = /^admin_\w+: ([0-9a-f-]{36})/i;
const LEGACY_NAMED_TARGET = /^(role|subclass)_\w+: (?:role )?(\d+) \(([^)]+)\)/;

interface ResolvedTarget {
  type: string;
  id: string | null;
}

const targetOf = (row: AuditLogRow, actorType: AuditActorType): ResolvedTarget | null => {
  if (row.targetType) return { type: row.targetType, id: row.targetId };
  // A guardian or administrator acting on a student
  if (actorType !== "student" && row.studentId !== null) {
    return { type: "student", id: String(row.studentId) };
  }
  if (actorType === "admin" && row.guardianId !== null) {
    return { type: "guardian", id: String(row.guardianId) };
  }
  const legacyAdmin = row.status?.match(LEGACY_ADMIN_TARGET);
  if (legacyAdmin) return { type: "admin", id: legacyAdmin[1] };
  const legacyNamed = row.status?.match(LEGACY_NAMED_TARGET);
  if (legacyNamed) return { type: legacyNamed[1], id: legacyNamed[2] };
  return null;
};

/** What an action with no specific record was performed on, by area. */
const AREA_TARGETS: Record<string, string> = {
  audit_logs: "Audit Logs",
  admin: "Administrators",
  business: "Bank Accounts",
  wallet: "Wallet",
  payment_link: "Payment Links",
  payment_item: "Payment Items",
  invoice: "Invoices",
  guardian: "Guardians",
  student: "Students",
  students: "Students",
  class: "Classes",
  subclass: "Classes",
};

const areaTarget = (
  row: AuditLogRow,
  code: string,
  actorType: AuditActorType,
): AuditLogEntry["target"] => {
  const area = code.split(".")[0];
  if (area === "auth") {
    const portal =
      actorType === "student" ? "Student Portal" : actorType === "guardian" ? "Guardian Portal" : "System";
    return { type: "system", id: null, name: portal };
  }
  if (area === "request" && row.path) return { type: "request", id: null, name: row.path };
  if (area === "manager" || area === "business") {
    return { type: area, id: null, name: AREA_TARGETS[area] ?? "Business" };
  }
  return AREA_TARGETS[area] ? { type: area, id: null, name: AREA_TARGETS[area] } : null;
};

interface Lookups {
  adminNames: Map<string, string>;
  adminRoles: Map<string, string>;
  roleNames: Map<string, string>;
  subclassNames: Map<string, string>;
}

const loadLookups = async (rows: AuditLogRow[], businessId: bigint): Promise<Lookups> => {
  const targets = rows.map((row) => targetOf(row, actorTypeOf(row)));
  const idsOf = (type: string) => [
    ...new Set(targets.filter((t) => t?.type === type && t.id).map((t) => t!.id as string)),
  ];
  const numericIdsOf = (type: string) =>
    idsOf(type).filter((id) => /^\d+$/.test(id)).map((id) => BigInt(id));

  const targetAdminIds = idsOf("admin");
  const actorAdminIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => !!id))];
  const roleIds = numericIdsOf("role");
  const subclassIds = numericIdsOf("subclass");

  const [admins, assignments, roles, subclasses] = await Promise.all([
    targetAdminIds.length
      ? prisma.users.findMany({
          where: { id: { in: targetAdminIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [],
    actorAdminIds.length
      ? prisma.userHasRole.findMany({
          where: { userId: { in: actorAdminIds }, businessId },
          select: { userId: true, role: { select: { name: true } } },
          orderBy: { id: "asc" },
        })
      : [],
    roleIds.length
      ? prisma.role.findMany({
          where: { id: { in: roleIds }, OR: [{ businessId }, { businessId: null }] },
          select: { id: true, name: true },
        })
      : [],
    subclassIds.length
      ? prisma.subclasses.findMany({
          where: { id: { in: subclassIds }, businessId },
          select: { id: true, name: true, class: { select: { name: true } } },
        })
      : [],
  ]);

  const adminRoles = new Map<string, string[]>();
  for (const { userId, role } of assignments) {
    if (!role) continue;
    adminRoles.set(userId, [...(adminRoles.get(userId) ?? []), role.name]);
  }

  return {
    adminNames: new Map(admins.map((admin) => [admin.id, fullName(admin) as string])),
    adminRoles: new Map([...adminRoles].map(([id, names]) => [id, names.join(", ")])),
    roleNames: new Map(roles.map((role) => [String(role.id), role.name])),
    subclassNames: new Map(
      subclasses.map((sub) => [String(sub.id), `${sub.class.name} ${sub.name}`]),
    ),
  };
};

const targetName = (row: AuditLogRow, target: ResolvedTarget, lookups: Lookups): string => {
  const snapshot = metadataField(row.metadata, "targetName");
  const legacyName = row.status?.match(LEGACY_NAMED_TARGET)?.[3];
  const id = target.id ?? "";

  switch (target.type) {
    case "student":
      return (row.studentId !== null && String(row.studentId) === id && fullName(row.students)) || `Student #${id}`;
    case "guardian":
      return (row.guardianId !== null && String(row.guardianId) === id && fullName(row.guardians)) || `Guardian #${id}`;
    case "admin":
      return lookups.adminNames.get(id) ?? "Deleted admin";
    case "role":
      return lookups.roleNames.get(id) ?? snapshot ?? legacyName ?? `Role #${id}`;
    case "subclass":
      return lookups.subclassNames.get(id) ?? snapshot ?? legacyName ?? `Subclass #${id}`;
    default:
      return snapshot ?? humanize(target.type);
  }
};

const actorOf = (
  row: AuditLogRow,
  actorType: AuditActorType,
  lookups: Lookups,
): AuditLogEntry["actor"] => {
  if (actorType === "admin" && row.user) {
    return {
      type: actorType,
      id: row.user.id,
      name: fullName(row.user) as string,
      role: lookups.adminRoles.get(row.user.id) ?? null,
    };
  }
  if (actorType === "guardian" && row.guardians) {
    return { type: actorType, id: String(row.guardians.id), name: fullName(row.guardians) as string, role: "Guardian" };
  }
  if (actorType === "student" && row.students) {
    return { type: actorType, id: String(row.students.id), name: fullName(row.students) as string, role: "Student" };
  }
  if (actorType === "system") return { type: actorType, id: null, name: "System", role: null };
  return {
    type: "anonymous",
    id: null,
    name: row.ipAddress ? `Unknown (${row.ipAddress})` : "Unknown",
    role: null,
  };
};

export const presentAuditLogs = async (
  rows: AuditLogRow[],
  businessId: bigint,
): Promise<AuditLogEntry[]> => {
  const lookups = await loadLookups(rows, businessId);

  return rows.map((row) => {
    const actorType = actorTypeOf(row);
    const code = row.action ?? "legacy.unmapped";
    const target = targetOf(row, actorType);
    const status = displayStatus(row.result, code);

    return {
      id: row.id,
      createdAt: row.createdAt,
      actor: actorOf(row, actorType, lookups),
      action: { code, label: actionLabel(row, code) },
      target: target
        ? { type: target.type, id: target.id, name: targetName(row, target, lookups) }
        : areaTarget(row, code, actorType),
      status,
      statusLabel: STATUS_LABELS[status],
      details: {
        description: row.status,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        httpMethod: row.httpMethod,
        path: row.path,
        requestId: row.requestId,
        metadata: row.metadata,
      },
    };
  });
};

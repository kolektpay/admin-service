/**
 * Every action code an audit row can carry. Keep in sync with
 * user-service/src/constants/auditActions.ts and with the backfill in
 * prisma/migrations/20261111140000_audit_log_actor_and_action.
 *
 * Codes are "<area>.<what happened>" so they can be filtered exactly
 * (action=student.blocked) or by area (action=auth.*).
 */
export const AUDIT_ACTIONS = [
  // Sign-in and account security
  "auth.login_succeeded",
  "auth.login_failed",
  "auth.login_rejected_blocked",
  "auth.logout",
  "auth.account_locked",
  "auth.account_unlocked",
  "auth.password_changed",
  "auth.password_forgot_requested",
  "auth.password_reset",
  "auth.temporary_password_changed",
  "auth.password_rotation_enforced",
  "auth.two_factor_setup",
  "auth.two_factor_enabled",

  // Audit logs
  "audit_logs.viewed",

  // Administrators and roles
  "admin.listed",
  "admin.viewed",
  "admin.created",
  "admin.updated",
  "admin.deleted",
  "admin.role_assigned",
  "admin.roles_changed",
  "admin.status_changed",
  "role.created",
  "role.deleted",
  "role.permissions_updated",

  // Business onboarding and bank accounts
  "manager.created",
  "business.created",
  "business.bank_added",
  "business.banks_listed",
  "business.bank_deleted",
  "business.bank_activated",
  "business.active_bank_viewed",

  // Wallets, payment links and payment items
  "wallet.details_viewed",
  "wallet.student_wallet_created",
  "wallet.pin_set",
  "payment_link.generated",
  "payment_link.listed",
  "payment_item.created",
  "payment_item.approved",

  // Students and guardians
  "student.created",
  "student.updated",
  "student.deleted",
  "student.blocked",
  "student.unblocked",
  "guardian.created",
  "guardian.updated",
  "guardian.deleted",
  "guardian.student_permissions_updated",

  // Classes, subclasses and class assignments
  "class.created",
  "class.updated",
  "class.deleted",
  "subclass.created",
  "subclass.updated",
  "subclass.deleted",
  "student.subclass_assigned",
  "student.subclass_unassigned",
  "students.assigned",
  "students.transferred",

  // Student and guardian app activity without a more specific code
  "invoice.listed",

  // Any other signed-in request, recorded by the request audit trail
  "request.get",
  "request.post",
  "request.put",
  "request.patch",
  "request.delete",

  // Rows written before action codes existed whose status matched nothing
  "legacy.unmapped",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const KNOWN_ACTIONS = new Set<string>(AUDIT_ACTIONS);

export const isAuditAction = (value: string): value is AuditAction =>
  KNOWN_ACTIONS.has(value);

/**
 * Class changes are logged with a status like "class_created: 16 (JSS 10)" or
 * "student_subclass_assigned: student 17 ...". The code is the part before the
 * colon with the area separated by a dot, matching the migration's backfill.
 */
export const classChangeAction = (status: string): AuditAction => {
  const prefix = status.split(":")[0];
  const code = prefix.replace(/^(class|subclass|students|student)_/, "$1.");
  return isAuditAction(code) ? code : "legacy.unmapped";
};

/** A fallback code for a signed-in request with no more specific code. */
export const requestAction = (method: string): AuditAction => {
  const code = `request.${method.toLowerCase()}`;
  return isAuditAction(code) ? code : "request.post";
};

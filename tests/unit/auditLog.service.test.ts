jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: {
    auditLogs: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    users: { findMany: jest.fn() },
    userHasRole: { findMany: jest.fn() },
    role: { findMany: jest.fn() },
    subclasses: { findMany: jest.fn() },
  },
}));
jest.mock("../../src/services/telegramLogger.service", () => ({
  logExceptionToTelegram: jest.fn().mockResolvedValue(undefined),
}));

import prismaClient from "../../src/config/database";
import {
  listAdminsAuditLogs,
  listGuardiansAuditLogs,
  listStudentsAuditLogs,
} from "../../src/services/auditLog.service";
import { presentAuditLogs } from "../../src/services/auditLogPresenter";
import {
  listAdminsAuditLogsQuerySchema,
  listGuardiansAuditLogsQuerySchema,
  listStudentsAuditLogsQuerySchema,
} from "../../src/validations/auditLog.schema";

const prisma = prismaClient as unknown as Record<string, Record<string, jest.Mock>>;

const BUSINESS_ID = BigInt(1);
const actor = { userId: "viewer-1", businessId: BUSINESS_ID, ip: "127.0.0.1" };
const ADMIN_ID = "8c1f6a2e-5b0d-4c9e-9f3a-2d7e4b6a1c90";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: BigInt(1),
  createdAt: new Date("2026-10-27T09:30:00Z"),
  result: "success",
  status: null,
  ipAddress: "10.0.0.1",
  actorType: "admin",
  action: "auth.login_succeeded",
  targetType: null,
  targetId: null,
  userId: "staff-1",
  studentId: null,
  guardianId: null,
  userAgent: null,
  httpMethod: null,
  path: null,
  requestId: null,
  metadata: null,
  user: { id: "staff-1", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
  students: null,
  guardians: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const model of ["users", "userHasRole", "role", "subclasses", "auditLogs"]) {
    prisma[model].findMany.mockResolvedValue([]);
  }
  prisma.auditLogs.count.mockResolvedValue(0);
  prisma.userHasRole.findMany.mockResolvedValue([
    { userId: "staff-1", role: { name: "System Administrator" } },
  ]);
});

describe("presentAuditLogs", () => {
  it("shows an admin sign-in as Login -> System with the admin's role", async () => {
    const [entry] = await presentAuditLogs([row()] as never, BUSINESS_ID);

    expect(entry).toMatchObject({
      actor: { type: "admin", name: "Jane Smith", role: "System Administrator" },
      action: { code: "auth.login_succeeded", label: "Login" },
      target: { type: "system", name: "System" },
      status: "success",
      statusLabel: "Success",
    });
  });

  it("names the role created, from the live role or the saved name", async () => {
    prisma.role.findMany.mockResolvedValue([{ id: BigInt(7), name: "Finance Manager" }]);
    const created = row({
      action: "role.created",
      targetType: "role",
      targetId: "7",
      metadata: { targetName: "Finance" },
    });
    const deleted = row({
      action: "role.deleted",
      targetType: "role",
      targetId: "9",
      metadata: { targetName: "Auditor" },
    });

    const [first, second] = await presentAuditLogs([created, deleted] as never, BUSINESS_ID);

    expect(first.action.label).toBe("Created Role");
    expect(first.target).toEqual({ type: "role", id: "7", name: "Finance Manager" });
    expect(second.target?.name).toBe("Auditor");
  });

  it("reads the target from older rows that only describe it in status", async () => {
    prisma.users.findMany.mockResolvedValue([{ id: ADMIN_ID, firstName: "Audit", lastName: "Officer" }]);
    const legacy = row({
      action: "admin.status_changed",
      result: "blocked",
      status: `admin_status_changed: ${ADMIN_ID} to blocked_by_admin due to Policy breach`,
    });

    const [entry] = await presentAuditLogs([legacy] as never, BUSINESS_ID);

    expect(entry.action.label).toBe("Blocked Admin");
    expect(entry.target).toMatchObject({ type: "admin", id: ADMIN_ID, name: "Audit Officer" });
    // Blocking someone is a successful action, not a blocked one
    expect(entry.status).toBe("success");
  });

  it("shows an admin acting on a student with the student as target", async () => {
    const [entry] = await presentAuditLogs(
      [
        row({
          action: "student.blocked",
          result: "blocked",
          studentId: BigInt(10),
          targetType: "student",
          targetId: "10",
          students: { id: BigInt(10), firstName: "Charlie", lastName: "Davis", registrationNumber: "R1" },
        }),
      ] as never,
      BUSINESS_ID,
    );

    expect(entry).toMatchObject({
      actor: { name: "Jane Smith" },
      action: { label: "Blocked Student" },
      target: { type: "student", name: "Charlie Davis" },
      status: "success",
    });
  });

  it("shows a guardian's failed sign-in against the Guardian Portal", async () => {
    const [entry] = await presentAuditLogs(
      [
        row({
          actorType: "guardian",
          action: "auth.login_failed",
          result: "failure",
          userId: null,
          user: null,
          guardianId: BigInt(4),
          guardians: { id: BigInt(4), firstName: "Mary", lastName: "Smith" },
        }),
      ] as never,
      BUSINESS_ID,
    );

    expect(entry).toMatchObject({
      actor: { type: "guardian", id: "4", name: "Mary Smith", role: "Guardian" },
      action: { label: "Failed Login" },
      target: { name: "Guardian Portal" },
      status: "failed",
      statusLabel: "Failed",
    });
  });

  it("shows a sign-in to no account as Unknown with the IP", async () => {
    const [entry] = await presentAuditLogs(
      [row({ actorType: "anonymous", userId: null, user: null, action: "auth.login_failed", result: "failure" })] as never,
      BUSINESS_ID,
    );

    expect(entry.actor).toEqual({ type: "anonymous", id: null, name: "Unknown (10.0.0.1)", role: null });
  });
});

describe("audit log tabs", () => {
  const whereOf = () => prisma.auditLogs.findMany.mock.calls[0][0].where.AND;

  it("leaves actions on students and guardians out of the Admin tab", async () => {
    await listAdminsAuditLogs(actor, listAdminsAuditLogsQuerySchema.parse({}));

    expect(whereOf()).toContainEqual({ actorType: "admin", studentId: null, guardianId: null });
  });

  it("includes what was done to students on the Student tab by default", async () => {
    await listStudentsAuditLogs(actor, listStudentsAuditLogsQuerySchema.parse({}));

    expect(whereOf()).toContainEqual({ OR: [{ actorType: "student" }, { studentId: { not: null } }] });
  });

  it("returns only what guardians did with scope=own", async () => {
    await listGuardiansAuditLogs(actor, listGuardiansAuditLogsQuerySchema.parse({ scope: "own" }));

    expect(whereOf()).toContainEqual({ actorType: "guardian" });
  });

  it("searches actor and target names, including administrators acted on", async () => {
    prisma.users.findMany.mockResolvedValueOnce([{ id: ADMIN_ID }]);

    await listAdminsAuditLogs(actor, listAdminsAuditLogsQuerySchema.parse({ search: " audit officer " }));

    const search = whereOf().find((clause: { OR?: unknown[] }) =>
      clause.OR?.some((branch) => (branch as { user?: unknown }).user),
    );
    expect(search.OR).toContainEqual({ targetType: "admin", targetId: { in: [ADMIN_ID] } });
    expect(search.OR).toContainEqual({ status: { contains: "audit officer", mode: "insensitive" } });
  });
});

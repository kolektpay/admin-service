import {
  createAdminSchema,
  listAdminsQuerySchema,
  roleAssignmentSchema,
  updateAdminSchema,
  updateAdminStatusSchema,
} from "../../src/validations/adminManagement.schema";
import {
  createRoleSchema,
  listPermissionsQuerySchema,
  listRolesQuerySchema,
  roleIdParamsSchema,
} from "../../src/validations/roleManagement.schema";

const isoDate = (offsetDays: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

describe("createRoleSchema", () => {
  it("normalises the name and de-duplicates permission IDs", () => {
    const parsed = createRoleSchema.parse({
      name: "  Senior   Bursar ",
      permissionIds: [3, "3", 5],
    });
    expect(parsed).toEqual({ name: "Senior Bursar", permissionIds: [BigInt(3), BigInt(5)] });
  });

  it.each([
    [{ name: "B", permissionIds: [1] }, "name"],
    [{ name: "Bursar!", permissionIds: [1] }, "name"],
    [{ name: "Bursar", permissionIds: [] }, "permissionIds"],
    [{ name: "Bursar", permissionIds: [0] }, "permissionIds"],
    [{ permissionIds: [1] }, "name"],
  ])("rejects %j", (body, field) => {
    const result = createRoleSchema.safeParse(body);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path[0]).toBe(field);
  });

  it("rejects unknown fields", () => {
    expect(
      createRoleSchema.safeParse({ name: "Bursar", permissionIds: [1], businessId: 9 }).success,
    ).toBe(false);
  });
});

describe("role listing schemas", () => {
  it("applies pagination defaults", () => {
    expect(listRolesQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
    expect(listPermissionsQuerySchema.parse({})).toEqual({ page: 1, limit: 200 });
  });

  it("enforces maximum limits", () => {
    expect(listRolesQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(listPermissionsQuerySchema.safeParse({ limit: "201" }).success).toBe(false);
  });

  it("rejects an unknown permission type", () => {
    expect(listPermissionsQuerySchema.safeParse({ type: "other" }).success).toBe(false);
  });

  it("parses roleId params to bigint", () => {
    expect(roleIdParamsSchema.parse({ roleId: "7" })).toEqual({ roleId: BigInt(7) });
    expect(roleIdParamsSchema.safeParse({ roleId: "abc" }).success).toBe(false);
  });
});

describe("createAdminSchema", () => {
  const body = {
    email: "  Jane.Smith@Example.com ",
    firstName: "Jane",
    lastName: "Smith",
    roleId: 7,
  };

  it("lower-cases email and names and parses the role", () => {
    expect(createAdminSchema.parse(body)).toEqual({
      email: "jane.smith@example.com",
      firstName: "jane",
      lastName: "smith",
      roleId: BigInt(7),
    });
  });

  it("accepts a single-element roleId array for existing clients", () => {
    expect(createAdminSchema.parse({ ...body, roleId: [7] }).roleId).toBe(BigInt(7));
  });

  it("rejects more than one role", () => {
    const result = createAdminSchema.safeParse({ ...body, roleId: [7, 8] });
    expect(result.success).toBe(false);
  });

  it.each(["email", "firstName", "lastName", "roleId"])("requires %s", (field) => {
    const { [field as keyof typeof body]: _omitted, ...rest } = body;
    expect(createAdminSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects fields that cannot be set, such as status or password", () => {
    expect(createAdminSchema.safeParse({ ...body, status: "active" }).success).toBe(false);
    expect(createAdminSchema.safeParse({ ...body, password: "x" }).success).toBe(false);
  });
});

describe("updateAdminSchema", () => {
  it("requires at least one field", () => {
    expect(updateAdminSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a role change on its own", () => {
    expect(updateAdminSchema.parse({ roleId: "8" })).toEqual({ roleId: BigInt(8) });
  });

  it("allows clearing the phone number", () => {
    expect(updateAdminSchema.parse({ phoneNumber: null })).toEqual({ phoneNumber: null });
  });
});

describe("listAdminsQuerySchema", () => {
  it("applies defaults and accepts combined filters", () => {
    expect(
      listAdminsQuerySchema.parse({
        role: "Bursar",
        status: "on_leave",
        name: "jane",
        email: "@Example.com",
      }),
    ).toEqual({
      page: 1,
      limit: 10,
      role: "Bursar",
      status: "on_leave",
      name: "jane",
      email: "@example.com",
    });
  });

  it("rejects an unknown status and an oversized limit", () => {
    expect(listAdminsQuerySchema.safeParse({ status: "retired" }).success).toBe(false);
    expect(listAdminsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });
});

describe("updateAdminStatusSchema", () => {
  it("accepts blocked with or without a reason", () => {
    expect(updateAdminStatusSchema.parse({ status: "blocked" })).toEqual({ status: "blocked" });
    expect(
      updateAdminStatusSchema.parse({ status: "blocked", reason: "Policy breach" }),
    ).toEqual({ status: "blocked", reason: "Policy breach" });
  });

  it("parses an on_leave request with a future return date", () => {
    const date = isoDate(14);
    expect(
      updateAdminStatusSchema.parse({
        status: "on_leave",
        reason: "Annual leave",
        expectedReturnDate: date,
      }),
    ).toEqual({
      status: "on_leave",
      reason: "Annual leave",
      expectedReturnDate: new Date(`${date}T00:00:00.000Z`),
    });
  });

  it.each([
    [{ status: "on_leave", expectedReturnDate: isoDate(5) }, "reason"],
    [{ status: "on_leave", reason: "Annual leave" }, "expectedReturnDate"],
    [{ status: "on_leave", reason: "Annual leave", expectedReturnDate: isoDate(0) }, "expectedReturnDate"],
    [{ status: "on_leave", reason: "Annual leave", expectedReturnDate: isoDate(-3) }, "expectedReturnDate"],
    [{ status: "on_leave", reason: "Annual leave", expectedReturnDate: "02/11/2026" }, "expectedReturnDate"],
    [{ status: "on_leave", reason: "Annual leave", expectedReturnDate: "2027-02-30" }, "expectedReturnDate"],
  ])("rejects %j", (body, field) => {
    const result = updateAdminStatusSchema.safeParse(body);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path[0]).toBe(field);
  });

  it("rejects statuses other than blocked and on_leave", () => {
    expect(updateAdminStatusSchema.safeParse({ status: "active" }).success).toBe(false);
  });

  it("rejects leave details on a block request", () => {
    expect(
      updateAdminStatusSchema.safeParse({ status: "blocked", expectedReturnDate: isoDate(3) })
        .success,
    ).toBe(false);
  });
});

describe("roleAssignmentSchema", () => {
  const userId = "321d02df-abcf-4ca7-a53d-75c2858633c0";

  it("requires exactly one role to assign", () => {
    expect(roleAssignmentSchema.safeParse({ action: "assign", userId }).success).toBe(false);
    expect(
      roleAssignmentSchema.safeParse({ action: "assign", userId, roleIds: [1, 2] }).success,
    ).toBe(false);
    expect(roleAssignmentSchema.parse({ action: "assign", userId, roleIds: [1] })).toEqual({
      action: "assign",
      userId,
      roleIds: [BigInt(1)],
    });
  });

  it("allows unassign without roles", () => {
    expect(roleAssignmentSchema.safeParse({ action: "unassign", userId }).success).toBe(true);
  });
});

jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: require("../helpers/prismaMock").createPrismaMock(),
}));
jest.mock("../../src/services/telegramLogger.service", () => ({
  logExceptionToTelegram: jest.fn().mockResolvedValue(undefined),
}));

import prismaClient from "../../src/config/database";
import { AppError } from "../../src/middleware/error.middleware";
import {
  createClass,
  createSubclass,
  deleteClass,
  deleteSubclass,
  getClass,
  listClasses,
  listSubclasses,
  updateClass,
  updateSubclass,
} from "../../src/services/class.service";
import { prismaError } from "../helpers/fixtures";
import { PrismaMock } from "../helpers/prismaMock";

const prisma = prismaClient as unknown as PrismaMock;

const BUSINESS_ID = BigInt(1);
const CLASS_ID = BigInt(4);
const SUBCLASS_ID = BigInt(12);
const actor = { userId: "staff-1", businessId: BUSINESS_ID, ip: "127.0.0.1" };

const classRow = (overrides: Record<string, unknown> = {}) => ({
  id: CLASS_ID,
  name: "Primary 1",
  category: "normal",
  description: null,
  createdAt: new Date("2026-10-20T09:00:00Z"),
  updatedAt: new Date("2026-10-20T09:00:00Z"),
  subclasses: [
    { id: BigInt(12), name: "A", _count: { students: 20 } },
    { id: BigInt(13), name: "B", _count: { students: 5 } },
  ],
  ...overrides,
});

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ statusCode, code });
};

describe("listClasses", () => {
  it("lists only the business's classes and totals student counts", async () => {
    prisma.classes.findMany.mockResolvedValue([classRow()]);
    prisma.classes.count.mockResolvedValue(21);

    const result = await listClasses(BUSINESS_ID, {
      page: 2,
      limit: 10,
      search: "prim",
      category: "normal",
    });

    const args = prisma.classes.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      businessId: BUSINESS_ID,
      category: "normal",
      OR: [
        { name: { contains: "prim", mode: "insensitive" } },
        { subclasses: { some: { name: { contains: "prim", mode: "insensitive" } } } },
      ],
    });
    expect(args).toMatchObject({ skip: 10, take: 10 });
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    expect(result.classes[0]).toMatchObject({
      name: "Primary 1",
      studentsCount: 25,
      subclasses: [
        { id: BigInt(12), name: "A", studentsCount: 20 },
        { id: BigInt(13), name: "B", studentsCount: 5 },
      ],
    });
  });
});

describe("getClass", () => {
  it("throws 404 for a class outside the business", async () => {
    prisma.classes.findFirst.mockResolvedValue(null);
    await expectAppError(getClass(CLASS_ID, BUSINESS_ID), 404, "CLASS_NOT_FOUND");
    expect(prisma.classes.findFirst.mock.calls[0][0].where).toEqual({
      id: CLASS_ID,
      businessId: BUSINESS_ID,
    });
  });
});

describe("createClass", () => {
  const input = { name: "Primary 1", category: "normal" as const, subclasses: ["A", "B"] };

  it("does not create subclasses unless they are listed", async () => {
    prisma.classes.findFirst.mockResolvedValue(null);
    prisma.classes.create.mockResolvedValue(classRow({ subclasses: [] }));

    const result = await createClass({ name: "SS 1", category: "normal", subclasses: [] }, actor);

    expect(prisma.classes.create.mock.calls[0][0].data.subclasses).toBeUndefined();
    expect(result.subclasses).toEqual([]);
  });

  it("creates the class with its subclasses and audits it", async () => {
    prisma.classes.findFirst.mockResolvedValue(null);
    prisma.classes.create.mockResolvedValue(classRow());

    const result = await createClass(input, actor);

    expect(prisma.classes.findFirst.mock.calls[0][0].where).toEqual({
      businessId: BUSINESS_ID,
      name: { equals: "Primary 1", mode: "insensitive" },
    });
    expect(prisma.classes.create.mock.calls[0][0].data).toMatchObject({
      businessId: BUSINESS_ID,
      name: "Primary 1",
      description: null,
      subclasses: { createMany: { data: [{ name: "A" }, { name: "B" }] } },
    });
    expect(prisma.auditLogs.create).toHaveBeenCalledTimes(1);
    expect(result.studentsCount).toBe(25);
  });

  it("rejects a name already used in the business", async () => {
    prisma.classes.findFirst.mockResolvedValue({ id: BigInt(9) });
    await expectAppError(createClass(input, actor), 409, "CLASS_NAME_TAKEN");
    expect(prisma.classes.create).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race to 409", async () => {
    prisma.classes.findFirst.mockResolvedValue(null);
    prisma.classes.create.mockRejectedValue(prismaError("P2002"));
    await expectAppError(createClass(input, actor), 409, "CLASS_NAME_TAKEN");
  });
});

describe("updateClass", () => {
  it("excludes the class itself from the name check and clears an empty description", async () => {
    prisma.classes.findFirst
      .mockResolvedValueOnce({ id: CLASS_ID, name: "Primary 1" })
      .mockResolvedValueOnce(null);
    prisma.classes.update.mockResolvedValue(classRow({ name: "Basic 1" }));

    await updateClass(CLASS_ID, { name: "Basic 1", description: "" }, actor);

    expect(prisma.classes.findFirst.mock.calls[1][0].where.id).toEqual({ not: CLASS_ID });
    expect(prisma.classes.update.mock.calls[0][0].data).toEqual({
      name: "Basic 1",
      category: undefined,
      description: null,
    });
    expect(prisma.auditLogs.create.mock.calls[0][0].data.status).toContain("renamed from Primary 1");
  });

  it("throws 404 for a class outside the business", async () => {
    prisma.classes.findFirst.mockResolvedValue(null);
    await expectAppError(updateClass(CLASS_ID, { category: "ube" }, actor), 404, "CLASS_NOT_FOUND");
    expect(prisma.classes.update).not.toHaveBeenCalled();
  });
});

describe("deleteClass", () => {
  it("refuses while students or payment items use the class", async () => {
    prisma.classes.findFirst.mockResolvedValue({
      id: CLASS_ID,
      name: "Primary 1",
      _count: { paymentItems: 3 },
    });
    prisma.students.count.mockResolvedValue(84);

    const promise = deleteClass(CLASS_ID, actor);
    await expectAppError(promise, 409, "CLASS_IN_USE");
    await expect(promise).rejects.toMatchObject({
      message: expect.stringContaining("84 student record(s) and 3 payment item(s)"),
    });
    expect(prisma.classes.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes an unused class, re-checking usage in the delete", async () => {
    prisma.classes.findFirst.mockResolvedValue({
      id: CLASS_ID,
      name: "Primary 1",
      _count: { paymentItems: 0 },
    });
    prisma.students.count.mockResolvedValue(0);
    prisma.classes.deleteMany.mockResolvedValue({ count: 1 });

    await deleteClass(CLASS_ID, actor);

    expect(prisma.classes.deleteMany.mock.calls[0][0].where).toEqual({
      id: CLASS_ID,
      businessId: BUSINESS_ID,
      paymentItems: { none: {} },
      subclasses: { none: { students: { some: {} } } },
    });
    expect(prisma.auditLogs.create).toHaveBeenCalledTimes(1);
  });

  it("reports in-use when usage appears between the check and the delete", async () => {
    prisma.classes.findFirst.mockResolvedValue({
      id: CLASS_ID,
      name: "Primary 1",
      _count: { paymentItems: 0 },
    });
    prisma.students.count.mockResolvedValue(0);
    prisma.classes.deleteMany.mockResolvedValue({ count: 0 });

    await expectAppError(deleteClass(CLASS_ID, actor), 409, "CLASS_IN_USE");
    expect(prisma.auditLogs.create).not.toHaveBeenCalled();
  });
});

const subclassRow = (overrides: Record<string, unknown> = {}) => ({
  id: SUBCLASS_ID,
  name: "JSS 1A",
  classId: CLASS_ID,
  class: { id: CLASS_ID, name: "JSS 1" },
  createdAt: new Date("2026-10-20T09:00:00Z"),
  updatedAt: new Date("2026-10-20T09:00:00Z"),
  _count: { students: 28 },
  ...overrides,
});

describe("listSubclasses", () => {
  it("scopes to the business and filters by parent class", async () => {
    prisma.subclasses.findMany.mockResolvedValue([subclassRow()]);
    prisma.subclasses.count.mockResolvedValue(1);

    const result = await listSubclasses(BUSINESS_ID, { page: 1, limit: 50, classId: CLASS_ID });

    expect(prisma.subclasses.findMany.mock.calls[0][0].where).toEqual({
      class: { businessId: BUSINESS_ID },
      classId: CLASS_ID,
    });
    expect(result.subclasses[0]).toMatchObject({ name: "JSS 1A", studentsCount: 28 });
    expect(result.subclasses[0]).not.toHaveProperty("_count");
  });
});

describe("createSubclass", () => {
  it("creates a subclass under a class in the business", async () => {
    prisma.classes.findFirst.mockResolvedValue({ id: CLASS_ID, name: "JSS 1" });
    prisma.subclasses.findFirst.mockResolvedValue(null);
    prisma.subclasses.create.mockResolvedValue(subclassRow({ _count: { students: 0 } }));

    const result = await createSubclass({ classId: CLASS_ID, name: "JSS 1A" }, actor);

    expect(prisma.classes.findFirst.mock.calls[0][0].where).toEqual({
      id: CLASS_ID,
      businessId: BUSINESS_ID,
    });
    expect(prisma.subclasses.create.mock.calls[0][0].data).toEqual({
      classId: CLASS_ID,
      name: "JSS 1A",
    });
    expect(result.studentsCount).toBe(0);
  });

  it("rejects a parent class outside the business", async () => {
    prisma.classes.findFirst.mockResolvedValue(null);
    await expectAppError(
      createSubclass({ classId: CLASS_ID, name: "JSS 1A" }, actor),
      404,
      "CLASS_NOT_FOUND",
    );
  });

  it("rejects a duplicate name within the class", async () => {
    prisma.classes.findFirst.mockResolvedValue({ id: CLASS_ID, name: "JSS 1" });
    prisma.subclasses.findFirst.mockResolvedValue({ id: BigInt(99) });
    await expectAppError(
      createSubclass({ classId: CLASS_ID, name: "jss 1a" }, actor),
      409,
      "SUBCLASS_NAME_TAKEN",
    );
  });
});

describe("updateSubclass", () => {
  const NEW_CLASS_ID = BigInt(11);

  it("moves a subclass to another class, checking the name in the new class", async () => {
    prisma.subclasses.findFirst
      .mockResolvedValueOnce({ id: SUBCLASS_ID, name: "A", classId: CLASS_ID, _count: { paymentItems: 0 } })
      .mockResolvedValueOnce(null);
    prisma.classes.findFirst.mockResolvedValue({ id: NEW_CLASS_ID, name: "JSS 2" });
    prisma.subclasses.updateMany.mockResolvedValue({ count: 1 });
    prisma.subclasses.findUniqueOrThrow.mockResolvedValue(subclassRow({ classId: NEW_CLASS_ID }));

    await updateSubclass(SUBCLASS_ID, { classId: NEW_CLASS_ID }, actor);

    expect(prisma.subclasses.findFirst.mock.calls[1][0].where).toMatchObject({
      classId: NEW_CLASS_ID,
      name: { equals: "A", mode: "insensitive" },
      id: { not: SUBCLASS_ID },
    });
    expect(prisma.subclasses.updateMany.mock.calls[0][0].where).toEqual({
      id: SUBCLASS_ID,
      paymentItems: { none: {} },
    });
  });

  it("rejects moving to a class outside the business", async () => {
    prisma.subclasses.findFirst.mockResolvedValue({
      id: SUBCLASS_ID,
      name: "A",
      classId: CLASS_ID,
      _count: { paymentItems: 0 },
    });
    prisma.classes.findFirst.mockResolvedValue(null);
    await expectAppError(updateSubclass(SUBCLASS_ID, { classId: NEW_CLASS_ID }, actor), 404, "CLASS_NOT_FOUND");
    expect(prisma.subclasses.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to move a subclass that payment items target", async () => {
    prisma.subclasses.findFirst.mockResolvedValue({
      id: SUBCLASS_ID,
      name: "A",
      classId: CLASS_ID,
      _count: { paymentItems: 2 },
    });
    prisma.classes.findFirst.mockResolvedValue({ id: NEW_CLASS_ID, name: "JSS 2" });
    await expectAppError(
      updateSubclass(SUBCLASS_ID, { classId: NEW_CLASS_ID }, actor),
      409,
      "SUBCLASS_HAS_PAYMENT_ITEMS",
    );
  });

  it("renames without a payment-item condition when the class is unchanged", async () => {
    prisma.subclasses.findFirst
      .mockResolvedValueOnce({ id: SUBCLASS_ID, name: "A", classId: CLASS_ID, _count: { paymentItems: 2 } })
      .mockResolvedValueOnce(null);
    prisma.subclasses.updateMany.mockResolvedValue({ count: 1 });
    prisma.subclasses.findUniqueOrThrow.mockResolvedValue(subclassRow({ name: "Gold" }));

    await updateSubclass(SUBCLASS_ID, { name: "Gold" }, actor);

    expect(prisma.subclasses.updateMany.mock.calls[0][0].where).toEqual({ id: SUBCLASS_ID });
  });
});

describe("deleteSubclass", () => {
  it("refuses while students are assigned", async () => {
    prisma.subclasses.findFirst.mockResolvedValue({
      id: SUBCLASS_ID,
      name: "A",
      classId: CLASS_ID,
      _count: { students: 2, paymentItems: 0 },
    });
    await expectAppError(deleteSubclass(SUBCLASS_ID, actor), 409, "SUBCLASS_IN_USE");
    expect(prisma.subclasses.deleteMany).not.toHaveBeenCalled();
  });

  it("maps a foreign-key race on delete to in-use", async () => {
    prisma.subclasses.findFirst.mockResolvedValue({
      id: SUBCLASS_ID,
      name: "A",
      classId: CLASS_ID,
      _count: { students: 0, paymentItems: 0 },
    });
    prisma.subclasses.deleteMany.mockRejectedValue(prismaError("P2003"));
    await expectAppError(deleteSubclass(SUBCLASS_ID, actor), 409, "SUBCLASS_IN_USE");
  });
});

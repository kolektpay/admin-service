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
  createSubclass,
  deleteSubclass,
  getClass,
  listClasses,
  listSubclasses,
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
  category: "standardClass",
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
  it("lists the global classes with only the business's subclasses and totals student counts", async () => {
    prisma.classes.findMany.mockResolvedValue([classRow()]);
    prisma.classes.count.mockResolvedValue(21);

    const result = await listClasses(BUSINESS_ID, {
      page: 2,
      limit: 10,
      search: "prim",
      category: "standardClass",
    });

    const args = prisma.classes.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      category: "standardClass",
      OR: [
        { name: { contains: "prim", mode: "insensitive" } },
        {
          subclasses: {
            some: { businessId: BUSINESS_ID, name: { contains: "prim", mode: "insensitive" } },
          },
        },
      ],
    });
    expect(args.select.subclasses.where).toEqual({ businessId: BUSINESS_ID });
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

  it("filters on the business's own subclasses for hasSubclasses", async () => {
    prisma.classes.findMany.mockResolvedValue([]);
    prisma.classes.count.mockResolvedValue(0);

    await listClasses(BUSINESS_ID, { page: 1, limit: 50, hasSubclasses: false });

    expect(prisma.classes.findMany.mock.calls[0][0].where).toEqual({
      subclasses: { none: { businessId: BUSINESS_ID } },
    });
  });
});

describe("getClass", () => {
  it("nests only the business's subclasses", async () => {
    prisma.classes.findUnique.mockResolvedValue(classRow());
    await getClass(CLASS_ID, BUSINESS_ID);
    const args = prisma.classes.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: CLASS_ID });
    expect(args.select.subclasses.where).toEqual({ businessId: BUSINESS_ID });
  });

  it("throws 404 for a class that does not exist", async () => {
    prisma.classes.findUnique.mockResolvedValue(null);
    await expectAppError(getClass(CLASS_ID, BUSINESS_ID), 404, "CLASS_NOT_FOUND");
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
      businessId: BUSINESS_ID,
      classId: CLASS_ID,
    });
    expect(result.subclasses[0]).toMatchObject({ name: "JSS 1A", studentsCount: 28 });
    expect(result.subclasses[0]).not.toHaveProperty("_count");
  });
});

describe("createSubclass", () => {
  it("creates a subclass owned by the business under a global class", async () => {
    prisma.classes.findUnique.mockResolvedValue({ id: CLASS_ID, name: "JSS 1" });
    prisma.subclasses.findFirst.mockResolvedValue(null);
    prisma.subclasses.create.mockResolvedValue(subclassRow({ _count: { students: 0 } }));

    const result = await createSubclass({ classId: CLASS_ID, name: "JSS 1A" }, actor);

    expect(prisma.classes.findUnique.mock.calls[0][0].where).toEqual({ id: CLASS_ID });
    expect(prisma.subclasses.findFirst.mock.calls[0][0].where).toEqual({
      classId: CLASS_ID,
      businessId: BUSINESS_ID,
      name: { equals: "JSS 1A", mode: "insensitive" },
    });
    expect(prisma.subclasses.create.mock.calls[0][0].data).toEqual({
      classId: CLASS_ID,
      businessId: BUSINESS_ID,
      name: "JSS 1A",
    });
    expect(result.studentsCount).toBe(0);
  });

  it("rejects a parent class that does not exist", async () => {
    prisma.classes.findUnique.mockResolvedValue(null);
    await expectAppError(
      createSubclass({ classId: CLASS_ID, name: "JSS 1A" }, actor),
      404,
      "CLASS_NOT_FOUND",
    );
  });

  it("rejects a duplicate name within the business's subclasses of the class", async () => {
    prisma.classes.findUnique.mockResolvedValue({ id: CLASS_ID, name: "JSS 1" });
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
    prisma.classes.findUnique.mockResolvedValue({ id: NEW_CLASS_ID, name: "JSS 2" });
    prisma.subclasses.updateMany.mockResolvedValue({ count: 1 });
    prisma.subclasses.findUniqueOrThrow.mockResolvedValue(subclassRow({ classId: NEW_CLASS_ID }));

    await updateSubclass(SUBCLASS_ID, { classId: NEW_CLASS_ID }, actor);

    expect(prisma.subclasses.findFirst.mock.calls[0][0].where).toEqual({
      id: SUBCLASS_ID,
      businessId: BUSINESS_ID,
    });
    expect(prisma.subclasses.findFirst.mock.calls[1][0].where).toMatchObject({
      classId: NEW_CLASS_ID,
      businessId: BUSINESS_ID,
      name: { equals: "A", mode: "insensitive" },
      id: { not: SUBCLASS_ID },
    });
    expect(prisma.subclasses.updateMany.mock.calls[0][0].where).toEqual({
      id: SUBCLASS_ID,
      paymentItems: { none: {} },
    });
  });

  it("rejects moving to a class that does not exist", async () => {
    prisma.subclasses.findFirst.mockResolvedValue({
      id: SUBCLASS_ID,
      name: "A",
      classId: CLASS_ID,
      _count: { paymentItems: 0 },
    });
    prisma.classes.findUnique.mockResolvedValue(null);
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
    prisma.classes.findUnique.mockResolvedValue({ id: NEW_CLASS_ID, name: "JSS 2" });
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

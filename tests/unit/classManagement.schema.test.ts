import {
  bulkTransferStudentsSchema,
  classIdParamsSchema,
  createSubclassSchema,
  listClassesQuerySchema,
  updateSubclassSchema,
} from "../../src/validations/classManagement.schema";

describe("createSubclassSchema", () => {
  it("normalises names", () => {
    expect(createSubclassSchema.parse({ classId: 4, name: "  JSS   1A " })).toEqual({
      classId: BigInt(4),
      name: "JSS 1A",
    });
  });

  it("rejects unknown fields and blank names", () => {
    expect(createSubclassSchema.safeParse({ classId: 4, name: "A", businessId: 2 }).success).toBe(
      false,
    );
    expect(createSubclassSchema.safeParse({ classId: 4, name: "   " }).success).toBe(false);
  });
});

describe("updateSubclassSchema", () => {
  it("requires at least one field", () => {
    expect(updateSubclassSchema.safeParse({}).success).toBe(false);
  });
});

describe("listClassesQuerySchema", () => {
  it("parses the hasSubclasses filter from the query string", () => {
    expect(listClassesQuerySchema.parse({ hasSubclasses: "false" }).hasSubclasses).toBe(false);
    expect(listClassesQuerySchema.safeParse({ hasSubclasses: "maybe" }).success).toBe(false);
  });
});

describe("bulkTransferStudentsSchema", () => {
  it("dedupes student ids", () => {
    expect(
      bulkTransferStudentsSchema.parse({
        sourceSubclassId: 12,
        destinationSubclassId: 15,
        studentIds: [1, 1, 2],
      }).studentIds,
    ).toEqual([BigInt(1), BigInt(2)]);
  });

  it("rejects the same source and destination", () => {
    const result = bulkTransferStudentsSchema.safeParse({
      sourceSubclassId: 12,
      destinationSubclassId: 12,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["destinationSubclassId"]);
  });

  it("rejects an empty student list", () => {
    expect(
      bulkTransferStudentsSchema.safeParse({
        sourceSubclassId: 12,
        destinationSubclassId: 15,
        studentIds: [],
      }).success,
    ).toBe(false);
  });
});

describe("classIdParamsSchema", () => {
  it("parses ids to bigint and rejects non-numeric ids", () => {
    expect(classIdParamsSchema.parse({ classId: "4" })).toEqual({ classId: BigInt(4) });
    expect(classIdParamsSchema.safeParse({ classId: "abc" }).success).toBe(false);
  });
});

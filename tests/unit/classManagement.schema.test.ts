import {
  bulkTransferStudentsSchema,
  classIdParamsSchema,
  createClassSchema,
  listClassesQuerySchema,
  updateClassSchema,
  updateSubclassSchema,
} from "../../src/validations/classManagement.schema";

describe("createClassSchema", () => {
  it("normalises names and creates no subclasses by default", () => {
    expect(createClassSchema.parse({ name: "  JSS   1 " })).toEqual({
      name: "JSS 1",
      category: "normal",
      subclasses: [],
    });
  });

  it("rejects subclass names repeated case-insensitively", () => {
    const result = createClassSchema.safeParse({ name: "JSS 1", subclasses: ["JSS 1A", "jss 1a"] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["subclasses", 1]);
  });

  it("rejects unknown fields and blank names", () => {
    expect(createClassSchema.safeParse({ name: "JSS 1", businessId: 2 }).success).toBe(false);
    expect(createClassSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("updateClassSchema / updateSubclassSchema", () => {
  it("require at least one field", () => {
    expect(updateClassSchema.safeParse({}).success).toBe(false);
    expect(updateSubclassSchema.safeParse({}).success).toBe(false);
  });

  it("allow clearing a class description with null", () => {
    expect(updateClassSchema.parse({ description: null })).toEqual({ description: null });
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

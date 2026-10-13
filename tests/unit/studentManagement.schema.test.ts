import {
  blockStudentSchema,
  bulkCreateStudentsSchema,
  bulkStudentRecordSchema,
  listStudentsQuerySchema,
  MAX_STUDENTS_PER_BULK_REQUEST,
  studentIdParamsSchema,
  unblockStudentSchema,
  updateStudentSchema,
} from "../../src/validations/studentManagement.schema";
import { validStudentRecord } from "../helpers/fixtures";

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join(".")) ?? [];

describe("bulkStudentRecordSchema", () => {
  it("accepts a valid record and normalises it", () => {
    const parsed = bulkStudentRecordSchema.parse(
      validStudentRecord({
        email: "  Ngozi.Adetunji@Example.COM ",
        registrationNumber: "  STU/001 ",
        firstName: "  Ngozi ",
      }),
    );

    expect(parsed.email).toBe("ngozi.adetunji@example.com");
    expect(parsed.registrationNumber).toBe("STU/001");
    expect(parsed.firstName).toBe("Ngozi");
    expect(parsed.subclassId).toBe(BigInt(3));
    expect(parsed.guardianId).toBe(BigInt(12));
    expect(parsed.dateOfBirth).toBeInstanceOf(Date);
  });

  it("coerces numeric-string ids to bigint", () => {
    const parsed = bulkStudentRecordSchema.parse(
      validStudentRecord({ subclassId: "7", guardianId: "9" }),
    );
    expect(parsed.subclassId).toBe(BigInt(7));
    expect(parsed.guardianId).toBe(BigInt(9));
  });

  it.each([
    ["subclassId", 0],
    ["subclassId", -1],
    ["subclassId", 1.5],
    ["guardianId", "abc"],
  ])("rejects invalid %s = %p", (field, value) => {
    const result = bulkStudentRecordSchema.safeParse(validStudentRecord({ [field]: value }));
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(field);
  });

  it.each([
    "firstName",
    "lastName",
    "email",
    "phoneNumber",
    "gender",
    "dateOfBirth",
    "age",
    "address",
    "subclassId",
    "guardianId",
    "city",
  ])("requires %s", (field) => {
    const record = validStudentRecord();
    delete (record as Record<string, unknown>)[field];
    const result = bulkStudentRecordSchema.safeParse(record);
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(field);
  });

  it("allows optional fields to be omitted or null", () => {
    const record = validStudentRecord();
    delete (record as Record<string, unknown>).middleName;
    delete (record as Record<string, unknown>).registrationNumber;
    delete (record as Record<string, unknown>).avatar;
    delete (record as Record<string, unknown>).alias;
    expect(bulkStudentRecordSchema.safeParse(record).success).toBe(true);

    expect(
      bulkStudentRecordSchema.safeParse(
        validStudentRecord({ middleName: null, registrationNumber: null, avatar: null }),
      ).success,
    ).toBe(true);
  });

  it.each([
    ["status", "active"],
    ["password", "secret"],
    ["isWalletCreated", true],
    ["businessId", 1],
    ["deletedAt", null],
  ])("rejects non-editable field %s", (field, value) => {
    const result = bulkStudentRecordSchema.safeParse(validStudentRecord({ [field]: value }));
    expect(result.success).toBe(false);
  });

  it.each(["not-an-email", "a@b", ""])("rejects invalid email %p", (email) => {
    expect(bulkStudentRecordSchema.safeParse(validStudentRecord({ email })).success).toBe(false);
  });

  it.each(["+2348031110021", "08031110021", "1234567"])("accepts phone %p", (phoneNumber) => {
    expect(bulkStudentRecordSchema.safeParse(validStudentRecord({ phoneNumber })).success).toBe(
      true,
    );
  });

  it.each(["123456", "+1234567890123456", "0803-111-0021", "phone"])(
    "rejects phone %p",
    (phoneNumber) => {
      expect(
        bulkStudentRecordSchema.safeParse(validStudentRecord({ phoneNumber })).success,
      ).toBe(false);
    },
  );

  it.each(["STU001", "STU/2026/001", "a_b-c"])("accepts registration number %p", (regNo) => {
    expect(
      bulkStudentRecordSchema.safeParse(validStudentRecord({ registrationNumber: regNo })).success,
    ).toBe(true);
  });

  it.each(["/STU001", "STU 001", "STU#1", "   ", "x".repeat(51)])(
    "rejects registration number %p",
    (regNo) => {
      expect(
        bulkStudentRecordSchema.safeParse(validStudentRecord({ registrationNumber: regNo }))
          .success,
      ).toBe(false);
    },
  );

  it("rejects a date of birth in the future", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const result = bulkStudentRecordSchema.safeParse(validStudentRecord({ dateOfBirth: tomorrow }));
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("dateOfBirth");
  });

  it.each([0, 101, 12.5, "13"])("rejects age %p", (age) => {
    expect(bulkStudentRecordSchema.safeParse(validStudentRecord({ age })).success).toBe(false);
  });

  it("rejects a non-URL avatar", () => {
    expect(
      bulkStudentRecordSchema.safeParse(validStudentRecord({ avatar: "not a url" })).success,
    ).toBe(false);
  });
});

describe("bulkCreateStudentsSchema", () => {
  it("accepts between 1 and the maximum number of students", () => {
    expect(bulkCreateStudentsSchema.safeParse({ students: [validStudentRecord()] }).success).toBe(
      true,
    );
    const max = Array.from({ length: MAX_STUDENTS_PER_BULK_REQUEST }, () => validStudentRecord());
    expect(bulkCreateStudentsSchema.safeParse({ students: max }).success).toBe(true);
  });

  it("rejects an empty batch", () => {
    const result = bulkCreateStudentsSchema.safeParse({ students: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("At least one student is required");
  });

  it("rejects a batch over the maximum", () => {
    const tooMany = Array.from({ length: MAX_STUDENTS_PER_BULK_REQUEST + 1 }, () =>
      validStudentRecord(),
    );
    expect(bulkCreateStudentsSchema.safeParse({ students: tooMany }).success).toBe(false);
  });

  it("reports the index of the invalid record", () => {
    const result = bulkCreateStudentsSchema.safeParse({
      students: [validStudentRecord(), validStudentRecord({ email: "bad" })],
    });
    expect(issuePaths(result)).toContain("students.1.email");
  });

  it("rejects unknown top-level keys", () => {
    expect(
      bulkCreateStudentsSchema.safeParse({ students: [validStudentRecord()], extra: true }).success,
    ).toBe(false);
  });
});

describe("studentIdParamsSchema", () => {
  it("transforms a numeric id to bigint", () => {
    expect(studentIdParamsSchema.parse({ studentId: "42" }).studentId).toBe(BigInt(42));
  });

  it("handles ids beyond Number.MAX_SAFE_INTEGER without precision loss", () => {
    expect(studentIdParamsSchema.parse({ studentId: "9007199254740993" }).studentId).toBe(
      BigInt("9007199254740993"),
    );
  });

  it.each(["abc", "-1", "1.5", ""])("rejects %p", (studentId) => {
    expect(studentIdParamsSchema.safeParse({ studentId }).success).toBe(false);
  });
});

describe("updateStudentSchema", () => {
  it("accepts a partial update", () => {
    expect(updateStudentSchema.parse({ firstName: " Ada " })).toEqual({ firstName: "Ada" });
  });

  it("rejects an empty body", () => {
    const result = updateStudentSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("At least one field must be provided");
  });

  it.each([
    ["status", "blocked"],
    ["guardianId", 1],
    ["city", "Lagos"],
    ["password", "x"],
  ])("rejects non-editable field %s", (field, value) => {
    expect(updateStudentSchema.safeParse({ [field]: value }).success).toBe(false);
  });

  it("allows nullable fields to be cleared", () => {
    expect(
      updateStudentSchema.parse({ middleName: null, registrationNumber: null, avatar: null }),
    ).toEqual({ middleName: null, registrationNumber: null, avatar: null });
  });
});

describe("blockStudentSchema / unblockStudentSchema", () => {
  it("requires a trimmed reason of 3-255 chars to block", () => {
    expect(blockStudentSchema.parse({ reason: "  Fraud " })).toEqual({ reason: "Fraud" });
    expect(blockStudentSchema.safeParse({}).success).toBe(false);
    expect(blockStudentSchema.safeParse({ reason: "  ab  " }).success).toBe(false);
    expect(blockStudentSchema.safeParse({ reason: "x".repeat(256) }).success).toBe(false);
  });

  it("makes the reason optional to unblock", () => {
    expect(unblockStudentSchema.safeParse({}).success).toBe(true);
    expect(unblockStudentSchema.safeParse({ reason: "ok" }).success).toBe(false);
    expect(unblockStudentSchema.safeParse({ reason: "Resolved" }).success).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(blockStudentSchema.safeParse({ reason: "Fraud", status: "x" }).success).toBe(false);
  });
});

describe("listStudentsQuerySchema", () => {
  it("applies defaults", () => {
    expect(listStudentsQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 50,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("coerces query-string numbers", () => {
    const parsed = listStudentsQuerySchema.parse({
      page: "2",
      limit: "10",
      age: "12",
      classId: "4",
    });
    expect(parsed).toMatchObject({ page: 2, limit: 10, age: 12, classId: BigInt(4) });
  });

  it.each([
    [{ page: "0" }, "page"],
    [{ limit: "101" }, "limit"],
    [{ limit: "0" }, "limit"],
    [{ sortBy: "password" }, "sortBy"],
    [{ sortOrder: "up" }, "sortOrder"],
    [{ status: "deleted" }, "status"],
    [{ age: "0" }, "age"],
  ])("rejects %p", (query, path) => {
    const result = listStudentsQuerySchema.safeParse(query);
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(path);
  });

  it("rejects combining age with minAge/maxAge", () => {
    const result = listStudentsQuerySchema.safeParse({ age: "10", minAge: "8" });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("age");
  });

  it("rejects minAge greater than maxAge", () => {
    const result = listStudentsQuerySchema.safeParse({ minAge: "12", maxAge: "10" });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("minAge");
  });

  it("accepts minAge equal to maxAge", () => {
    expect(listStudentsQuerySchema.safeParse({ minAge: "10", maxAge: "10" }).success).toBe(true);
  });

  it("parses calendar dates as UTC midnight", () => {
    const parsed = listStudentsQuerySchema.parse({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(parsed.startDate?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(parsed.endDate?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it.each(["2026-02-30", "2026-13-01", "01-01-2026", "2026-1-1", "2026-01-01T00:00:00Z"])(
    "rejects invalid date %p",
    (startDate) => {
      expect(listStudentsQuerySchema.safeParse({ startDate }).success).toBe(false);
    },
  );

  it("accepts Feb 29 in a leap year only", () => {
    expect(listStudentsQuerySchema.safeParse({ startDate: "2028-02-29" }).success).toBe(true);
    expect(listStudentsQuerySchema.safeParse({ startDate: "2027-02-29" }).success).toBe(false);
  });

  it("rejects startDate after endDate", () => {
    const result = listStudentsQuerySchema.safeParse({
      startDate: "2026-02-01",
      endDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("startDate");
  });
});

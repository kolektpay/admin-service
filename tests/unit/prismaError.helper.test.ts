import { getUniqueViolationField, isPrismaErrorCode } from "../../src/helpers/prismaError.helper";
import { prismaError } from "../helpers/fixtures";

const aliases = {
  registrationNumber: ["registration_number", "registrationNumber"],
  phoneNumber: ["phone_number", "phoneNumber"],
  email: ["email"],
};

describe("isPrismaErrorCode", () => {
  it("matches a Prisma error with the given code", () => {
    expect(isPrismaErrorCode(prismaError("P2002"), "P2002")).toBe(true);
  });

  it("rejects a different code", () => {
    expect(isPrismaErrorCode(prismaError("P2025"), "P2002")).toBe(false);
  });

  it("rejects non-Prisma errors, even with a matching code property", () => {
    expect(isPrismaErrorCode(Object.assign(new Error("x"), { code: "P2002" }), "P2002")).toBe(
      false,
    );
    expect(isPrismaErrorCode(null, "P2002")).toBe(false);
  });
});

describe("getUniqueViolationField", () => {
  it("reads the native engine meta.target", () => {
    expect(getUniqueViolationField(prismaError("P2002", { target: ["phone_number"] }), aliases)).toBe(
      "phoneNumber",
    );
  });

  it("reads driver adapter metadata", () => {
    const error = prismaError("P2002", {
      driverAdapterError: { cause: { constraint: { fields: ["registration_number"] } } },
    });
    expect(getUniqueViolationField(error, aliases)).toBe("registrationNumber");
  });

  it("falls back to the error message", () => {
    const error = prismaError("P2002", {}, "Unique constraint failed on the fields: (`email`)");
    expect(getUniqueViolationField(error, aliases)).toBe("email");
  });

  it("returns undefined when no alias matches", () => {
    expect(getUniqueViolationField(prismaError("P2002", { target: ["id"] }), aliases)).toBeUndefined();
  });

  it("prefers the earlier (more specific) field when several aliases appear", () => {
    const error = prismaError("P2002", { target: ["students_email_registration_number_key"] });
    expect(getUniqueViolationField(error, aliases)).toBe("registrationNumber");
  });
});

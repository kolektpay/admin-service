import { Prisma } from "@prisma/client";

/** A raw (pre-validation) student record as a client would send it. */
export const validStudentRecord = (overrides: Record<string, unknown> = {}) => ({
  firstName: "Ngozi",
  middleName: "Ada",
  lastName: "Adetunji",
  email: "ngozi.adetunji@example.com",
  phoneNumber: "+2348031110021",
  registrationNumber: "STU001",
  gender: "Female",
  dateOfBirth: "2013-09-14",
  age: 13,
  address: "Ikeja, Lagos",
  avatar: "https://example.com/avatar.png",
  subclassId: 3,
  guardianId: 12,
  city: "Lagos",
  alias: "ngozi",
  ...overrides,
});

export const prismaError = (
  code: string,
  meta: Record<string, unknown> = {},
  message = "Prisma error",
) => new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "test", meta });

import { StudentStatus } from "@prisma/client";
import { z } from "zod";

import { calendarDateSchema } from "./common.schema";

export const MAX_STUDENTS_PER_BULK_REQUEST = 100;
export const MAX_STUDENTS_PER_PAGE = 100;

const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .transform((value) => BigInt(value));

// Emails are stored lower-cased; registration numbers are stored trimmed
// (the student login flow matches registration numbers exactly as typed).
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Invalid email address" }).max(255));

const registrationNumberSchema = z
  .string()
  .trim()
  .min(1, { message: "Registration number cannot be empty" })
  .max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, {
    message:
      "Registration number may only contain letters, numbers, '/', '_' and '-'",
  });

const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?\d{7,14}$/, { message: "Invalid phone number" });

const nameSchema = z.string().trim().min(1).max(100);

const dateOfBirthSchema = z.coerce
  .date()
  .refine((date) => date <= new Date(), {
    message: "Date of birth cannot be in the future",
  });

/**
 * Student fields that staff may set. Anything not listed here
 * (status, password, wallet flags, audit timestamps, businessId, ...)
 * is rejected by the strict schemas below.
 */
const editableStudentFields = {
  firstName: nameSchema,
  lastName: nameSchema,
  middleName: nameSchema.nullable(),
  email: emailSchema,
  phoneNumber: phoneNumberSchema,
  registrationNumber: registrationNumberSchema.nullable(),
  gender: z.string().trim().min(1).max(20),
  dateOfBirth: dateOfBirthSchema,
  age: z.number().int().min(1).max(100),
  address: z.string().trim().min(1).max(500),
  avatar: z.url().max(2048).nullable(),
  subclassId: idSchema,
};

// ==========================================
// Bulk creation
// ==========================================

export const bulkStudentRecordSchema = z.strictObject({
  ...editableStudentFields,
  middleName: editableStudentFields.middleName.optional(),
  registrationNumber: editableStudentFields.registrationNumber.optional(),
  avatar: editableStudentFields.avatar.optional(),
  guardianEmail: emailSchema,
  // Wallet provisioning details (sent to the payment service, not stored)
  city: z.string().trim().min(1).max(100),
  alias: z.string().trim().min(1).max(100).optional(),
});

export const bulkCreateStudentsSchema = z.strictObject({
  students: z
    .array(bulkStudentRecordSchema)
    .min(1, { message: "At least one student is required" })
    .max(MAX_STUDENTS_PER_BULK_REQUEST, {
      message: `A maximum of ${MAX_STUDENTS_PER_BULK_REQUEST} students can be created per request`,
    }),
});

// ==========================================
// Update
// ==========================================

export const studentIdParamsSchema = z.object({
  studentId: z
    .string()
    .regex(/^\d+$/, { message: "studentId must be a positive integer" })
    .transform((value) => BigInt(value)),
});

export const updateStudentSchema = z
  .strictObject(editableStudentFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ==========================================
// Block / unblock
// ==========================================

export const blockStudentSchema = z.strictObject({
  reason: z.string().trim().min(3).max(255),
});

export const unblockStudentSchema = z.strictObject({
  reason: z.string().trim().min(3).max(255).optional(),
});

// ==========================================
// Listing
// ==========================================

export const STUDENT_SORT_FIELDS = [
  "createdAt",
  "firstName",
  "lastName",
  "registrationNumber",
  "age",
] as const;

const ageSchema = z.coerce.number().int().min(1).max(100);

export const listStudentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_STUDENTS_PER_PAGE).default(50),
    name: z.string().trim().min(1).max(100).optional(),
    regNo: registrationNumberSchema.optional(),
    class: z.string().trim().min(1).max(100).optional(),
    classId: idSchema.optional(),
    subclassId: idSchema.optional(),
    age: ageSchema.optional(),
    minAge: ageSchema.optional(),
    maxAge: ageSchema.optional(),
    startDate: calendarDateSchema.optional(),
    endDate: calendarDateSchema.optional(),
    status: z.enum(StudentStatus).optional(),
    // Free-text search across name and registration number (kept for existing clients)
    search: z.string().trim().min(1).max(100).optional(),
    sortBy: z.enum(STUDENT_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine((q) => q.age === undefined || (q.minAge === undefined && q.maxAge === undefined), {
    message: "Use either age or minAge/maxAge, not both.",
    path: ["age"],
  })
  .refine((q) => !q.minAge || !q.maxAge || q.minAge <= q.maxAge, {
    message: "minAge cannot be greater than maxAge",
    path: ["minAge"],
  })
  .refine((q) => !q.startDate || !q.endDate || q.startDate <= q.endDate, {
    message: "startDate cannot be after endDate",
    path: ["startDate"],
  });

export type BulkStudentRecord = z.infer<typeof bulkStudentRecordSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

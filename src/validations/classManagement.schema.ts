import { ClassCategory, StudentStatus } from "@prisma/client";
import { z } from "zod";

export const MAX_CLASSES_PER_PAGE = 100;
export const MAX_SUBCLASSES_PER_PAGE = 100;
export const MAX_STUDENTS_PER_PAGE = 100;
export const MAX_SUBCLASSES_PER_CLASS = 26;
export const MAX_STUDENTS_PER_TRANSFER = 1000;

const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .transform((value) => BigInt(value));

const idParamSchema = (name: string) =>
  z
    .string()
    .regex(/^\d+$/, { message: `${name} must be a positive integer` })
    .transform((value) => BigInt(value));

const searchSchema = z.string().trim().min(1).max(100);

const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

// Names are compared case-insensitively, so whitespace is collapsed to stop
// "JSS 1" and "JSS  1" being treated as different classes.
const nameSchema = (label: string, max: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, { message: `${label} name is required` })
        .max(max, { message: `${label} name must not exceed ${max} characters` }),
    );

export const classNameSchema = nameSchema("Class", 50);
export const subclassNameSchema = nameSchema("Subclass", 50);

const descriptionSchema = z
  .string()
  .trim()
  .max(255, { message: "Description must not exceed 255 characters" });

const atLeastOneField = (input: Record<string, unknown>) =>
  Object.values(input).some((value) => value !== undefined);

// ==========================================
// Classes
// ==========================================

export const listClassesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_CLASSES_PER_PAGE).default(50),
  search: searchSchema.optional(),
  category: z.enum(ClassCategory).optional(),
  hasSubclasses: booleanQuerySchema.optional(),
});

export const classIdParamsSchema = z.object({
  classId: idParamSchema("classId"),
});

export const createClassSchema = z.strictObject({
  name: classNameSchema,
  category: z.enum(ClassCategory).default("normal"),
  description: descriptionSchema.optional(),
  // Only created when listed: classes do not need subclasses
  subclasses: z
    .array(subclassNameSchema)
    .max(MAX_SUBCLASSES_PER_CLASS)
    .default([])
    .superRefine((names, ctx) => {
      const seen = new Set<string>();
      names.forEach((name, index) => {
        const key = name.toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: "custom",
            path: [index],
            message: `Subclass "${name}" is listed more than once`,
          });
        }
        seen.add(key);
      });
    }),
});

export const updateClassSchema = z
  .strictObject({
    name: classNameSchema.optional(),
    category: z.enum(ClassCategory).optional(),
    // null clears the description
    description: descriptionSchema.nullable().optional(),
  })
  .refine(atLeastOneField, { message: "Provide at least one field to update" });

// ==========================================
// Subclasses
// ==========================================

export const listSubclassesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_SUBCLASSES_PER_PAGE).default(50),
  classId: idSchema.optional(),
  search: searchSchema.optional(),
});

export const subclassIdParamsSchema = z.object({
  subclassId: idParamSchema("subclassId"),
});

export const createSubclassSchema = z.strictObject({
  classId: idSchema,
  name: subclassNameSchema,
});

export const updateSubclassSchema = z
  .strictObject({
    name: subclassNameSchema.optional(),
    // Moves the subclass, and the students in it, under another class
    classId: idSchema.optional(),
  })
  .refine(atLeastOneField, { message: "Provide at least one field to update" });

export const listSubclassStudentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_STUDENTS_PER_PAGE).default(50),
  search: searchSchema.optional(),
  status: z.enum(StudentStatus).optional(),
});

// ==========================================
// Student assignment
// ==========================================

export const assignStudentSchema = z.strictObject({
  subclassId: idSchema,
});

export const bulkTransferStudentsSchema = z
  .strictObject({
    sourceSubclassId: idSchema,
    destinationSubclassId: idSchema,
    // Omitted: every student in the source subclass moves
    studentIds: z
      .array(idSchema)
      .min(1, { message: "Provide at least one student, or omit studentIds to move everyone" })
      .max(MAX_STUDENTS_PER_TRANSFER)
      .transform((ids) => [...new Set(ids)])
      .optional(),
  })
  .refine((input) => input.sourceSubclassId !== input.destinationSubclassId, {
    message: "Source and destination subclasses must be different",
    path: ["destinationSubclassId"],
  });

export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ListSubclassesQuery = z.infer<typeof listSubclassesQuerySchema>;
export type CreateSubclassInput = z.infer<typeof createSubclassSchema>;
export type UpdateSubclassInput = z.infer<typeof updateSubclassSchema>;
export type ListSubclassStudentsQuery = z.infer<typeof listSubclassStudentsQuerySchema>;
export type AssignStudentInput = z.infer<typeof assignStudentSchema>;
export type BulkTransferStudentsInput = z.infer<typeof bulkTransferStudentsSchema>;

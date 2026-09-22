import { z } from "zod";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const studentInfoCreationValidationSchema = z.object({
  subclassId: z.string(),
  age: z.number().int().positive(),
  gender: z.string(),
avatar: z.string(),
  dateOfBirth: z.coerce.date(),

  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional(),

  registrationNumber: z.string().optional(),

  address: z.string(),
  email: z
    .string()
    .email()
    .regex(emailRegex, { message: "Invalid email address" })
    .optional(),
  phoneNumber: z.string().max(15),

  parentPhoneNumber: z.string().max(15),
  parentEmail: z
    .string()
    .email()
    .regex(emailRegex, { message: "Invalid email address" })
    .optional(),
  parentName: z.string(),
});

export const createStudentsSchema = z
  .union([studentInfoCreationValidationSchema, z.array(studentInfoCreationValidationSchema)])
  .transform((data) => (Array.isArray(data) ? data : [data]));

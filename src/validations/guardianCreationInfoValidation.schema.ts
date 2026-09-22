import { z } from "zod";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const guardianInfoCreationValidationSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional(),

  address: z.string(),
  email: z
    .string()
    .email()
    .regex(emailRegex, { message: "Invalid email address" })
    .optional(),
  phoneNumber: z.string().max(15),
});

export const createGuardianSchema = z
  .union([
    guardianInfoCreationValidationSchema,
    z.array(guardianInfoCreationValidationSchema),
  ])
  .transform((data) => (Array.isArray(data) ? data : [data]));

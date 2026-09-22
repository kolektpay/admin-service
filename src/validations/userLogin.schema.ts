import { z } from "zod";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const UserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(emailRegex, { message: "Invalid email address" })
    .transform((email) => email.toLowerCase()),

  password: z.string().trim(),

  code: z.string().trim().optional(),
});
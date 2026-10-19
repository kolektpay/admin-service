import { z } from "zod";

// Password regex for complexity
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const passwordValidationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .regex(emailRegex, { message: "Please provide a valid email address" }),

    defaultPassword: z
      .string()
      .trim()
      .min(8, { message: "Default must be at least 8 characters" }),

    newPassword: z
      .string()
      .trim()
      .min(8, { message: "New password must be at least 8 characters" })
      .regex(passwordRegex, {
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      }),

    confirmNewPassword: z.string().trim(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

export const blockUserValidationSchema = z.object({
  reason: z.string().trim().toLowerCase().min(1, "Reason is required"),
});

export const getUserValidationSchemaForReqBodyUuid = z.object({
  userId: z.string().uuid({ message: "Invalid user ID format" }),
});

export const changeUserPasswordVoluntarilyValidationSchema = z
  .object({
    userId: z.string().uuid({ message: "Invalid user ID format" }),
    oldPassword: z.string().trim(),
    newPassword: z
      .string()
      .trim()
      .min(8, { message: "New password must be at least 8 characters" })
      .regex(passwordRegex, {
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      }),

    confirmNewPassword: z.string().trim(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });


import { z } from "zod";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//donno if there should be regex for reg number but for now, we will just check if the input is not empty
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export const StudentOrGuardianLoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, { message: "Email or registration number is required" })
    .transform((val) => (emailRegex.test(val) ? val.toLowerCase() : val)),

  password: z.string().trim(),
});

export const studentChangePasswordValidationSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(1, { message: "Email or registration number is required" })
      .transform((val) => (emailRegex.test(val) ? val.toLowerCase() : val)),

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

export const forgotPasswordValidationSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, { message: "Email or registration number is required" })
    .transform((val) => (emailRegex.test(val) ? val.toLowerCase() : val)),
});

export const studentResetPasswordValidationSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(1, { message: "Token is required" }),

    password: z
      .string()
      .trim()
      .min(8, { message: "New password must be at least 8 characters" })
      .regex(passwordRegex, {
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      }),

    confirmPassword: z.string().trim(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

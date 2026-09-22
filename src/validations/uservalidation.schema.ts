import { z } from "zod";

// Password regex for complexity
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createUserValidationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(emailRegex, { message: "Please provide a valid email address" }),
  firstName: z
    .string()
    .trim()
    .min(2, { message: "First name must be at least 2 characters" })
    .max(50, { message: "First name must not exceed 50 characters" }),
  lastName: z
    .string()
    .trim()
    .min(2, { message: "Last name must be at least 2 characters" })
    .max(50, { message: "Last name must not exceed 50 characters" }),
  roleId: z.union([
    z.number().int().positive(),
    z
      .array(z.number().int().positive())
      .min(1, { message: "At least one role ID is required" }),
  ]),
});

export const updateUserValidationSchema = z.object({
  firstName: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, { message: "First name must be at least 2 characters" })
    .max(50, { message: "First name must not exceed 50 characters" })
    .optional(),
  lastName: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, { message: "Last name must be at least 2 characters" })
    .max(50, { message: "Last name must not exceed 50 characters" })
    .optional(),
});

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

// For UUID param validation
export const getUserValidationByUuidSchema = z.object({
  id: z.string().uuid({ message: "Invalid user ID format" }),
});

export const blockUserValidationSchema = z.object({
  reason: z.string().trim().toLowerCase().min(1, "Reason is required"),
});

export const roleActionSchema = z.object({
  roleIds: z
    .array(
      z
        .number()
        .int()
        .positive({ message: "Each roleId must be a positive integer" }),
    )
    .optional(), // can be empty or omitted
  action: z.enum(["assign", "unassign"], {
    message: "action must be either 'assign' or 'unassign'",
  }),
  userId: z.string().uuid({ message: "Invalid user ID format" }),
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

export const getUserWithOptionalQueryParamsAndSearch = z.object({
  page: z.coerce.number().int().positive().default(1),

  limit: z.coerce.number().int().positive().max(100).default(10),

  search: z.string().trim().toLowerCase().optional(),

  status: z
    .enum(
      ["active", "inactive", "blocked", "suspended", "pending", "otp_verify"],
      {
        message:
          "status must be either 'inactive' or 'inactive' or 'blocked' or 'suspended' or 'pending' or 'otp_verify'",
      },
    )
    .optional(),
});

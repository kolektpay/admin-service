import { z } from "zod";
export const updatePermissionsSchema = z.object({
  studentId: z.coerce.bigint(),
  permissions: z.array(z.string()),
});

export const getPermissionsQuerySchema = z
  .object({
    studentEmail: z.string().email().optional(),
    registrationNumber: z.string().optional(),
  })
  .refine((data) => !(data.studentEmail && data.registrationNumber), {
    message: "Provide either studentEmail or registrationNumber, not both",
    path: ["studentEmail"],
  });

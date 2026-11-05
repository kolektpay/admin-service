import { z } from "zod";

export const createStudentWalletSchema = z.object({

  student: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    middleName: z.string().optional(),
    emailAddress: z.string().email(),
    mobileNumber: z.string(),
    address: z.string().min(1),
    city: z.string().min(1),
    alias: z.string().min(1).optional(),
    // Must be declared here: validate() replaces req.body with the parsed result,
    // and zod strips unknown keys, so an undeclared studentId would be dropped.
    studentId: z.coerce.number().int().positive(),

  }),
});
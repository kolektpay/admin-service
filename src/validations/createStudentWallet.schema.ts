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
  
  }),
});
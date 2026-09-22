import { z } from "zod";

export const paymentItemGeneratorSchema = z
  .object({
    classId: z.coerce
      .bigint({ error: "Class ID must be a valid number" })
      .positive({ message: "Class ID must be greater than 0" }),

    name: z
      .string()
      .trim()
      .min(1, { message: "Payment item name is required" }),

    description: z
      .string()
      .trim()
      .min(1, { message: "Description is required" }),

    amount: z
      .number({ error: "Amount must be a number" })
      .positive({ message: "Amount must be greater than 0" }),

    startDate: z.coerce.date({
      error: "Start date must be a valid date",
    }),

    endDate: z.coerce.date({
      error: "End date must be a valid date",
    }),

    paymentType: z
      .array(
        z.enum(["wallet", "widget"], {
          error: "Payment type must be either wallet or widget",
        }),
      )
      .min(1, { message: "At least one payment type is required" }),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

import { z } from "zod";

export const walletSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export const paymentItemWalletParamsSchema = z.object({
  paymentItemId: z
    .string()
    .regex(/^\d+$/, { message: "paymentItemId must be a positive integer" }),
});

export type WalletSearchQuery = z.infer<typeof walletSearchQuerySchema>;
export type PaymentItemWalletParams = z.infer<typeof paymentItemWalletParamsSchema>;

import { z } from "zod";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const disposableDomains = [
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "temp-mail.org",
  "yopmail.com",
  "throwawaymail.com",
  "sharklasers.com",
  "getnada.com",
  "moakt.com",
  "trashmail.com",
];

export const liveEmailCheckSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(emailRegex, { message: "Invalid email address" })
    .refine(
      (email) => {
        const domain = email.split("@")[1];
        return !disposableDomains.includes(domain);
      },
      { message: "Disposable email addresses are not allowed" },
    )
    .transform((email) => email.toLowerCase()),
});

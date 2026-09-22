import { generateSecret, generate, verify } from "otplib";
import prisma from "../config/database";
import { getTimestampMinutesFromNow } from "../helpers/date.helper";
import ApiError from "./apiError";

// OTP config
const OTP_PERIOD_SECONDS = 900; // 15 minutes
const OTP_DIGITS = 6;

class OtpGenerator {
  /**
   * Generate a secret, store it, and return OTP token
   */
  static async generateAndStoreOtp(userEmail: string): Promise<string> {
    const secret = generateSecret();

    // Store secret + expiry
    await prisma.users.update({
      where: { email: userEmail },
      data: {
        otpSecret: secret,
        otpExpiresAt: getTimestampMinutesFromNow(15),
      },
    });

    // Generate OTP token
    const token = await generate({
      secret,
      digits: OTP_DIGITS,
      period: OTP_PERIOD_SECONDS,
    });

    return token;
  }

  /**
   * Verify OTP
   */
  static async verify(userEmail: string, token: string): Promise<boolean> {
    // Ensure 6 digits
    if (!/^\d{6}$/.test(token)) {
      throw new ApiError(400, "Invalid OTP format");
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail },
      select: {
        otpSecret: true,
        otpExpiresAt: true,
      },
    });

    if (!user || !user.otpSecret) {
      throw new ApiError(403, "OTP not sent");
    }

    // Check expiry
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new ApiError(403, "OTP expired");
    }

    try {
      const result = await verify({
        secret: user.otpSecret,
        token,
        digits: OTP_DIGITS,
        period: OTP_PERIOD_SECONDS,
      });

      if (!result.valid) {
        throw new ApiError(403, "Invalid OTP");
      }

      // Clear OTP after success (one-time use)
      await prisma.users.update({
        where: { email: userEmail },
        data: {
          otpSecret: null,
          otpExpiresAt: null,
        },
      });

      return true;
    } catch {
      throw new ApiError(403, "Invalid OTP");
    }
  }
}

export default OtpGenerator;

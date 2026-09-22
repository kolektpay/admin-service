import bcrypt from "bcrypt";
import { getTimestampMinutesFromNow, isPastDate } from "../helpers/date.helper";

export class PasswordResetTokenManager {
  private static readonly TOKEN_EXPIRY_MINUTES = 60; // 60 minutes
  private static readonly TOKEN_LENGTH = 6; // bytes
  // private static readonly SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 17); // bcrypt salt rounds
  private static readonly CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  /**
   * Generate a new password reset token
   * @returns Object containing plain token, hashed token, and expiration date
   */
  static async generate() {
    const randomBytes = crypto.getRandomValues(
      new Uint8Array(this.TOKEN_LENGTH),
    );
    const token = Array.from(randomBytes)
      .map((byte) => this.CHARSET[byte % this.CHARSET.length])
      .join("");

    const expiresAt = getTimestampMinutesFromNow(this.TOKEN_EXPIRY_MINUTES);

    return {
      token,
      expiresAt,
    };
  }

  /**
   * Check if a token has expired
   * @param expiresAt - Expiration date from database
   * @returns true if expired, false otherwise
   */
  static isExpired(expiresAt: Date): boolean {
    return isPastDate(expiresAt);
  }

  /**
   * Verify a password reset token
   * @param providedToken - Token from user (email link)
   * @param storedHashedToken - Token hash from database
   * @returns Validation result with valid flag and optional error message
   */
  static async verify(
    providedToken: string,
    storedHashedToken: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const isValid = await bcrypt.compare(providedToken, storedHashedToken);

    if (!isValid) {
      return { valid: false, error: "Invalid token" };
    }

    return { valid: true };
  }

  /**
   * Clear expired tokens from database
   * @param clearExpiredTokensCallback - DB function to remove expired tokens
   */
  static async cleanupExpiredTokens(
    clearExpiredTokensCallback: () => Promise<number>,
  ): Promise<number> {
    try {
      const deletedCount = await clearExpiredTokensCallback();
      console.log(`Cleaned up ${deletedCount} expired password reset tokens`);
      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up expired tokens:", error);
      throw error;
    }
  }

  /**
   * Invalidate a token (set it to null in DB)
   * @param invalidateTokenCallback - DB function to invalidate token
   */
  static async invalidateToken(
    invalidateTokenCallback: () => Promise<void>,
  ): Promise<void> {
    try {
      await invalidateTokenCallback();
      console.log("Token invalidated successfully");
    } catch (error) {
      console.error("Error invalidating token:", error);
      throw error;
    }
  }
}

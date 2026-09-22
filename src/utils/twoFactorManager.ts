import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

class TotpManager {
  private static config = {
    secret: "",
    uri: "",
    qrCode: "",
  };

  /**
   * Generate a new TOTP secret
   */
  static generateSecret(): void {
    this.config.secret = generateSecret();
  }

  /**
   * Generate otpauth:// URI for QR code
   */
  static generateOtpAuthUri(
    email: string,
    issuer: string,
    secret: string,
  ): void {
    this.config.uri = generateURI({
      issuer,
      label: email,
      secret,
    });
  }

  /**
   * Generate QR code from URI
   */
  static async generateQrCode(uri: string): Promise<void> {
    this.config.qrCode = await QRCode.toDataURL(uri);
  }

  /**
   * Does everything in one go and returns the config
   */
  static async setup2faData(
    email: string,
    issuer: string,
  ): Promise<typeof TotpManager.config> {
    this.generateSecret();
    this.generateOtpAuthUri(email, issuer, this.config.secret);
    await this.generateQrCode(this.config.uri);
    return this.config;
  }

  /**
   * Verify a user-provided TOTP code
   */
  static async verifyToken(secret: string, token: string): Promise<boolean> {
    const result = await verify({
      secret,
      token,
      epochTolerance: 30, // 30 seconds tolerance
    });

    return result.valid;
  }
}

export default TotpManager;

import bcrypt from "bcrypt";

export class TempPasswordTokenManager {
  private static readonly TOKEN_LENGTH = 8;

  static generateToken(): string {
    const characters =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    const array = new Uint8Array(this.TOKEN_LENGTH);
    crypto.getRandomValues(array);

    return Array.from(array)
      .map((byte) => characters.charAt(byte % characters.length))
      .join("");
  }

  static async verifyPasswordToken(
    plainPasswordToken: string,
    hashedPasswordToken: string,
  ): Promise<boolean> {
    return await bcrypt.compare(plainPasswordToken, hashedPasswordToken);
  }
}

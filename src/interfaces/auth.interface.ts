export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;

}

export interface TokenPayload {
  userId?: string;
  studentId?: bigint;
  guardianId?: bigint;
  tokenId: string;
  businessId: number;
  type: "access" | "refresh";
  role: string;
}

export interface KolektSuperAdminTokenPayload {
  userId?: string;
  studentId?: bigint;
  guardianId?: bigint;
  tokenId: string;
  type: "access" | "refresh";
   role: string;
}

export interface Setup2FAResponse {
  secret: string; // temporary TOTP secret
  otpauthUri: string; // URI for manual entry / authenticator apps
  qrCodeBase64: string; // Base64 PNG of QR code
}

export interface FinalUserInfoInterface {
  id: string;
  firstName: string;
  email: string;
  totpEnabled: boolean;
}

export interface UserLoginInfoInterface {
  name: string;
  accessToken: string;
  refreshToken: string;
  userEmail: string;
  totpEnabled: boolean;
}

export interface KolektSuperAdminLoginInfoInterface {
  name: string;
  role: string[];
  accessToken: string;
  refreshToken: string;
  permissions: {
    menus: string[];
    actions: string[];
  };
  userEmail: string;
  totpEnabled: boolean;
}

export interface UserLoginInfoIfNo2faInterface {
  name: string;
  userEmail: string;
  totpEnabled: boolean;
  totpRequired: boolean;
}
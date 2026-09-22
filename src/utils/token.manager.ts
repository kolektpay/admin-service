import jwt, { SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import {
  KolektSuperAdminTokenPayload,
  TokenPair,
  TokenPayload,
} from "../interfaces/auth.interface";

import { UserTokens } from "@prisma/client";
import prisma from "../config/database";
import ApiError from "./apiError";
import { UserRoleModel } from "../models/userHasRole.model";

// ──────────────────────────────────────────────────────────────
// Force secrets to be defined (will crash early if missing – good!)
// ──────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = (process.env.JWT_REFRESH_SECRET ||
  process.env.JWT_SECRET) as string;

if (!process.env.JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is not defined in the environment.",
  );
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRATION_TIME
  ? `${process.env.JWT_REFRESH_EXPIRATION_TIME}`
  : "7d";

class TokenManager {
  //   ──────────────────────────────────────────────────────────────
  //   Safe expiry calculator – no more TS2345 / TS2538 errors
  //   ──────────────────────────────────────────────────────────────
  private static calculateExpiryDate(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return new Date(Date.now() + 15 * 60 * 1000); // fallback 15 min
    }

    const value = Number(match[1]); // Number() never returns NaN here because of regex
    const unit = match[2] as "s" | "m" | "h" | "d";

    const msPerUnit: Record<typeof unit, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * msPerUnit[unit]);
  }

  //   ──────────────────────────────────────────────────────────────
  //   Work out whether a bigint id belongs to a student or a guardian
  //   (same student-first, guardian-fallback pattern used elsewhere)
  //   ──────────────────────────────────────────────────────────────
  private static async resolveAccountRole(
    accountId: bigint,
  ): Promise<"student" | "guardian" | "user"> {
    const isStudent = await prisma.students.findUnique({
      where: { id: accountId },
      select: { id: true },
    });

    // if (isStudent) {
    //   return "student";
    // }

    // return "guardian";

    if (isStudent) {
      return "student";
    } else {
      const isGuardian = await prisma.guardians.findUnique({
        where: { id: accountId },
        select: { id: true },
      });

      if (isGuardian) {
        return "guardian";
      } else {
        return "user";
      }
    }

    return "guardian";
  }

  //   ──────────────────────────────────────────────────────────────
  //   Generate tokens – fully type-safe
  //   ──────────────────────────────────────────────────────────────
  static async generateTokens(userId: string | bigint): Promise<TokenPair> {
    const accessTokenId = uuidv4();
    const refreshTokenId = uuidv4();

    const isClientKolektSuperAdmin =
      typeof userId === "string"
        ? await prisma.userHasRole.findFirst({
            where: {
              userId,
              role: {
                name: "Kolekt-super-admin",
              },
            },
            include: {
              role: true,
            },
          })
        : null;

    let accountRole: "student" | "guardian" | "user" | null = null;
    if (typeof userId !== "string") {
      accountRole = await this.resolveAccountRole(userId);
    }

    if (!isClientKolektSuperAdmin) {
      if (typeof userId === "string") {
        const fetchedBusinessId = Number(
          await UserRoleModel.getBusinessIdByUserId(
            userId,
            (accountRole = "user"),
          ),
        );

        const accessPayload: TokenPayload = {
          userId,
          tokenId: accessTokenId,
          businessId: fetchedBusinessId,
          type: "access",
          role: "user",
        };
        const refreshPayload: TokenPayload = {
          userId,
          tokenId: refreshTokenId,
          businessId: fetchedBusinessId,
          type: "refresh",
          role: "user",
        };

        this.revokeAllUserTokens(userId);

        const accessToken = jwt.sign(accessPayload, JWT_SECRET, {
          expiresIn: JWT_EXPIRES_IN,
        } as SignOptions);

        const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
          expiresIn: REFRESH_EXPIRES_IN,
        } as SignOptions);

        const accessExpiresAt = this.calculateExpiryDate(JWT_EXPIRES_IN);
        const refreshExpiresAt = this.calculateExpiryDate(REFRESH_EXPIRES_IN);

        try {
          await Promise.all([
            prisma.userTokens.create({
              data: {
                tokenId: accessTokenId,
                type: "access",
                tokenExpiresAt: accessExpiresAt,
                revoked: false,
                userId,
              },
            }),
            prisma.userTokens.create({
              data: {
                tokenId: refreshTokenId,
                type: "refresh",
                tokenExpiresAt: refreshExpiresAt,
                revoked: false,
                userId,
              },
            }),
          ]);
        } catch (error) {
          console.log("error:" + error);
        }

        return {
          accessToken,
          refreshToken,
          accessExpiresAt,
          refreshExpiresAt,
        };
      } else if (accountRole === "student") {
        const studentId = BigInt(userId);
        const fetchedBusinessId = Number(
          await UserRoleModel.getBusinessIdByUserId(studentId, accountRole),
        );

        if (!fetchedBusinessId) {
          throw new ApiError(
            404,
            "No business exists for this user or student id",
          );
        }

        const accessPayload: TokenPayload = {
          studentId,
          tokenId: accessTokenId,
          businessId: fetchedBusinessId,
          type: "access",
          role: "student",
        };
        const refreshPayload: TokenPayload = {
          studentId,
          tokenId: refreshTokenId,
          businessId: fetchedBusinessId,
          type: "refresh",
          role: "student",
        };

        this.revokeAllUserTokens(studentId, "student");

        const accessToken = jwt.sign(accessPayload, JWT_SECRET, {
          expiresIn: JWT_EXPIRES_IN,
        } as SignOptions);

        const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
          expiresIn: REFRESH_EXPIRES_IN,
        } as SignOptions);

        const accessExpiresAt = this.calculateExpiryDate(JWT_EXPIRES_IN);
        const refreshExpiresAt = this.calculateExpiryDate(REFRESH_EXPIRES_IN);

        try {
          await Promise.all([
            prisma.userTokens.create({
              data: {
                tokenId: accessTokenId,
                type: "access",
                tokenExpiresAt: accessExpiresAt,
                revoked: false,
                studentId,
              },
            }),
            prisma.userTokens.create({
              data: {
                tokenId: refreshTokenId,
                type: "refresh",
                tokenExpiresAt: refreshExpiresAt,
                revoked: false,
                studentId,
              },
            }),
          ]);
        } catch (error) {
          console.log("error:" + error);
        }

        return {
          accessToken,
          refreshToken,
          accessExpiresAt,
          refreshExpiresAt,
        };
      } else {
        const guardianId = BigInt(userId);

        console.log("guardianId: " + guardianId);
        const fetchedBusinessId = Number(
          await UserRoleModel.getBusinessIdByUserId(guardianId, accountRole = "guardian"),
        );

        if (!fetchedBusinessId) {
          throw new ApiError(
            404,
            "No business exists for this user or guardian id",
          );
        }

        const accessPayload: TokenPayload = {
          guardianId,
          tokenId: accessTokenId,
          businessId: fetchedBusinessId,
          type: "access",
          role: "guardian",
        };
        const refreshPayload: TokenPayload = {
          guardianId,
          tokenId: refreshTokenId,
          businessId: fetchedBusinessId,
          type: "refresh",
          role: "guardian",
        };

        this.revokeAllUserTokens(guardianId, "guardian");

        const accessToken = jwt.sign(accessPayload, JWT_SECRET, {
          expiresIn: JWT_EXPIRES_IN,
        } as SignOptions);

        const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
          expiresIn: REFRESH_EXPIRES_IN,
        } as SignOptions);

        const accessExpiresAt = this.calculateExpiryDate(JWT_EXPIRES_IN);
        const refreshExpiresAt = this.calculateExpiryDate(REFRESH_EXPIRES_IN);

        try {
          await Promise.all([
            prisma.userTokens.create({
              data: {
                tokenId: accessTokenId,
                type: "access",
                tokenExpiresAt: accessExpiresAt,
                revoked: false,
                guardianId,
              },
            }),
            prisma.userTokens.create({
              data: {
                tokenId: refreshTokenId,
                type: "refresh",
                tokenExpiresAt: refreshExpiresAt,
                revoked: false,
                guardianId,
              },
            }),
          ]);
        } catch (error) {
          console.log("error:" + error);
        }

        return {
          accessToken,
          refreshToken,
          accessExpiresAt,
          refreshExpiresAt,
        };
      }
    } else {
      // A Kolekt super admin is always a string-userId account (the check
      // above only ever runs against the user branch), so this path is
      // only reachable for that case.
      const accessPayload: KolektSuperAdminTokenPayload = {
        userId: userId as string,
        tokenId: accessTokenId,
        type: "access",
        role: "Kolekt-super-admin",
      };
      const refreshPayload: KolektSuperAdminTokenPayload = {
        userId: userId as string,
        tokenId: refreshTokenId,
        type: "refresh",
        role: "Kolekt-super-admin",
      };

      this.revokeAllUserTokens(userId as string);

      const accessToken = jwt.sign(accessPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      } as SignOptions);

      const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRES_IN,
      } as SignOptions);

      const accessExpiresAt = this.calculateExpiryDate(JWT_EXPIRES_IN);
      const refreshExpiresAt = this.calculateExpiryDate(REFRESH_EXPIRES_IN);

      try {
        await Promise.all([
          prisma.userTokens.create({
            data: {
              tokenId: accessTokenId,
              type: "access",
              tokenExpiresAt: accessExpiresAt,
              revoked: false,
              userId: userId as string,
            },
          }),
          prisma.userTokens.create({
            data: {
              tokenId: refreshTokenId,
              type: "refresh",
              tokenExpiresAt: refreshExpiresAt,
              revoked: false,
              userId: userId as string,
            },
          }),
        ]);
      } catch (error) {
        console.log("error:" + error);
      }

      return {
        accessToken,
        refreshToken,
        accessExpiresAt,
        refreshExpiresAt,
      };
    }
  }

  //   ──────────────────────────────────────────────────────────────
  //   Verify token
  //   ──────────────────────────────────────────────────────────────
  static async verifyAccessToken(
    token: string,
    type: "access" | "refresh" = "access",
  ): Promise<{
    decoded: TokenPayload;
    tokenData: UserTokens;
  }> {
    const secret = type === "access" ? JWT_SECRET : JWT_REFRESH_SECRET;

    let decoded: TokenPayload;
    try {
      decoded = (await jwt.verify(token, secret)) as TokenPayload;
    } catch (err: any) {
      if (err.name === "TokenExpiredError")
        throw new ApiError(403, "Token has expired");
      throw new ApiError(403, "Invalid or expired token");
    }

    if (decoded.userId) {
      if (
        !decoded.tokenId ||
        decoded.type !== type ||
        typeof decoded.userId !== "string"
      ) {
        throw new ApiError(403, "Invalid token claims");
      }
    } else if (decoded.studentId) {
      if (
        !decoded.tokenId ||
        decoded.type !== type ||
        typeof decoded.studentId === "string"
      ) {
        throw new ApiError(403, "Invalid token claims.");
      }
      decoded.studentId = BigInt(decoded.studentId);
    } else if (decoded.guardianId) {
      if (
        !decoded.tokenId ||
        decoded.type !== type ||
        typeof decoded.guardianId === "string"
      ) {
        throw new ApiError(403, "Invalid token claims");
      }
      decoded.guardianId = BigInt(decoded.guardianId);
    } else {
      throw new ApiError(403, "Invalid token claims");
    }

    const tokenData = await prisma.userTokens.findFirst({
      where: {
        tokenId: decoded.tokenId,
        type,
        revoked: false,
      },
    });

    if (!tokenData) throw new ApiError(403, "Token revoked or not found");

    if (tokenData.tokenExpiresAt && new Date() > tokenData.tokenExpiresAt) {
      throw new ApiError(403, "Token has expired");
    }

    return { decoded, tokenData };
  }

  static async verifyRefreshToken(
    token: string,
    type: "access" | "refresh" = "refresh",
  ): Promise<{ decoded: TokenPayload; tokenData: UserTokens }> {
    const secret = type === "refresh" ? JWT_REFRESH_SECRET : JWT_SECRET;

    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, secret) as TokenPayload;
    } catch (err: any) {
      if (err.name === "TokenExpiredError")
        throw new ApiError(403, "Token has expired");
      throw new ApiError(403, "Invalid or expired token");
    }

    //redirect to user login page if refresh token has expired

    if (decoded.userId) {
      if (
        !decoded.tokenId ||
        decoded.type !== type ||
        typeof decoded.userId !== "string"
      ) {
        throw new ApiError(403, "Invalid token claims");
      }
    } else if (decoded.studentId) {
      if (
        !decoded.tokenId ||
        decoded.type !== type ||
        typeof decoded.studentId === "string"
      ) {
        throw new ApiError(403, "Invalid token claims");
      }

      decoded.studentId = BigInt(decoded.studentId);
    } else if (decoded.guardianId) {
      if (
        !decoded.tokenId ||
        decoded.type !== type ||
        typeof decoded.guardianId === "string"
      ) {
        throw new ApiError(403, "Invalid token claims");
      }

      decoded.guardianId = BigInt(decoded.guardianId);
    } else {
      throw new ApiError(403, "Invalid token claims");
    }

    const tokenData = await prisma.userTokens.findFirst({
      where: {
        tokenId: decoded.tokenId,
        type,
        revoked: false, //revoked: true if student or user is logged out of application,
      },
    });

    if (!tokenData) throw new ApiError(403, "Token revoked or not found");

    if (tokenData.tokenExpiresAt && new Date() > tokenData.tokenExpiresAt) {
      throw new ApiError(403, "Token has expired");
    }

    return { decoded, tokenData };
  }

  static async revokeToken(tokenId: string): Promise<void> {
    await prisma.userTokens.update({
      where: { tokenId },
      data: { revoked: true },
    });
  }

  //   ──────────────────────────────────────────────────────────────
  //   Revoke tokens – accepts an explicit role for bigint ids so it
  //   doesn't have to re-run the student/guardian lookup when the
  //   caller (generateTokens) has already resolved it.
  //   ──────────────────────────────────────────────────────────────
  static async revokeAllUserTokens(
    userId: string | bigint,
    accountRole?: "student" | "guardian" | "user",
  ): Promise<void> {
    if (typeof userId === "string") {
      await prisma.userTokens.updateMany({
        where: {
          userId,
          revoked: false,
        },
        data: { revoked: true },
      });
      return;
    }

    let role = accountRole;
    if (!role) {
      role = await this.resolveAccountRole(userId);
    }

    if (role === "student") {
      const studentId = BigInt(userId);
      await prisma.userTokens.updateMany({
        where: {
          studentId,
          revoked: false,
        },
        data: { revoked: true },
      });
    } else {
      const guardianId = BigInt(userId);
      await prisma.userTokens.updateMany({
        where: {
          guardianId,
          revoked: false,
        },
        data: { revoked: true },
      });
    }
  }
}

export default TokenManager;

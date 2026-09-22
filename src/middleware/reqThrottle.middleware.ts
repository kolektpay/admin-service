import { Request, Response, NextFunction } from "express";
import { extractRequestMetadata } from "../utils/request.metadata";
import { errorResponse } from "../utils/response.util";
import { incrementAndCheck } from "../cache/throttleStore";
import { UserPasswordResetModel } from "../models/userPasswordReset.model";

/**
 * Rate-limit middleware factory
 */
export const requestThrottle =
  (limit: number, windowSeconds: number) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ip } = extractRequestMetadata(req);
      const { token } = req.body;
   

      /**
       * Identify user (if exists)
       * Used for user-based throttling
       */
      const userIdFromToken = await UserPasswordResetModel.obtainToken(token);

      /**
       * 1️⃣ IP-based throttle (always applied)
       */
      const ipTTL = await incrementAndCheck(
        `throttle:ip:${ip}`,
        limit,
        windowSeconds,
      );

      if (ipTTL !== null) {
        return errorResponse(
          res,
          `Too many requests. Please try again in ${ipTTL} seconds`,
          429,
        );
      }

      /**
       * 2️⃣ User-based throttle (only if user exists)
       */
      if (userIdFromToken?.userId) {
        const userTTL = await incrementAndCheck(
          `throttle:user:${userIdFromToken.userId}`,
          limit,
          windowSeconds,
        );

        if (userTTL !== null) {
          return errorResponse(res, "Too many requests", 429);
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };

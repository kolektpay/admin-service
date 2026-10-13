import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { badRequest } from "../utils/response.util";
import { AppError } from "./error.middleware";

export const validate =
  (schema: z.ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body); // ← assigns transformed result back to req.body
      console.log("✅ Validation passed!");
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log(error.issues);
        return badRequest(res, error.issues[0].message);
      }
    }
  };

export const validateUserQueryParams =
  (schema: z.ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query);
      console.log("✅ Validation passed!");
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log(error.issues);
        return badRequest(res, error.issues[0].message);
      }
    }
  };

export const validateUserParams =
  (schema: z.ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.params);
      console.log("✅ Validation passed!!");
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log(error.issues);
        return badRequest(res, error.issues[0].message);
      }
    }
  };

/**
 * Validates and normalises one part of the request (body, params or query),
 * replacing it with the parsed result. Failures are forwarded to the central
 * error handler with field-level details.
 */
export const validateRequest =
  (part: "body" | "params" | "query", schema: z.ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || part,
        message: issue.message,
      }));
      return next(
        new AppError("Request validation failed", 400, "VALIDATION_ERROR", details),
      );
    }

    // defineProperty rather than assignment: req.query is a getter in Express 5
    Object.defineProperty(req, part, {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    next();
  };

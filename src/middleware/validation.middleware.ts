import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { badRequest } from "../utils/response.util";

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
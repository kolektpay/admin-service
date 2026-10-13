jest.mock("../../src/services/telegramLogger.service", () => ({
  logExceptionToTelegram: jest.fn().mockResolvedValue(undefined),
}));

import { Request, Response } from "express";
import { z } from "zod";
import { validateRequest } from "../../src/middleware/validation.middleware";
import { AppError } from "../../src/middleware/error.middleware";

const schema = z.object({ count: z.coerce.number().int().min(1), nested: z.object({ a: z.string() }).optional() });
const res = {} as Response;

describe("validateRequest", () => {
  it("replaces the request part with the parsed data and calls next()", () => {
    const req = { query: { count: "5" } } as unknown as Request;
    const next = jest.fn();
    validateRequest("query", schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ count: 5 });
  });

  it("overrides a getter-only property (Express 5 req.query)", () => {
    const req = {} as Request;
    Object.defineProperty(req, "query", { get: () => ({ count: "2" }), configurable: true });
    validateRequest("query", schema)(req, res, jest.fn());
    expect(req.query).toEqual({ count: 2 });
  });

  it("forwards a 400 AppError with field details on failure", () => {
    const req = { body: { count: "0", nested: { a: 1 } } } as unknown as Request;
    const next = jest.fn();
    validateRequest("body", schema)(req, res, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "count" }),
        expect.objectContaining({ field: "nested.a" }),
      ]),
    );
    expect(req.body).toEqual({ count: "0", nested: { a: 1 } });
  });

  it("names the request part when the issue has no path", () => {
    const req = { body: undefined } as unknown as Request;
    const next = jest.fn();
    validateRequest("body", schema)(req, res, next);
    expect((next.mock.calls[0][0] as AppError).details).toEqual([
      expect.objectContaining({ field: "body" }),
    ]);
  });
});

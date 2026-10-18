import { Request, Response } from "express";

import { asyncHandler } from "../../src/utils/asyncHandler";

const req = {} as Request;
const res = {} as Response;

describe("asyncHandler", () => {
  it("forwards a rejected promise to next", async () => {
    const error = new Error("boom");
    const next = jest.fn();
    asyncHandler(async () => {
      throw error;
    })(req, res, next);
    await new Promise(setImmediate);
    expect(next).toHaveBeenCalledWith(error);
  });

  it("does not call next when the handler resolves", async () => {
    const next = jest.fn();
    const handler = jest.fn().mockResolvedValue(undefined);
    asyncHandler(handler)(req, res, next);
    await new Promise(setImmediate);
    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

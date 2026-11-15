import { NextFunction, Request, Response } from "express";

import prisma from "../config/database";
import { AuditAction, requestAction } from "../constants/auditActions";
import { AuditRow, createAuditLog } from "../models/audit.model";
import {
  getAuditContext,
  routePath,
  runWithAuditContext,
} from "../utils/auditContext";

/**
 * Codes for routes whose request-level entry deserves something more specific
 * than request.<method>. Keys are "<METHOD> <route pattern>".
 */
const ROUTE_ACTIONS: Record<string, AuditAction> = {};

/** The signed-in account behind a request, as audit row columns. */
const actorFromRequest = (
  req: Request,
): Pick<AuditRow, "userId" | "studentId" | "guardianId" | "actorType"> | null => {
  if (req.userId === undefined || req.userId === null) return null;

  try {
    if (req.role === "student") {
      return { studentId: BigInt(req.userId), actorType: "student" };
    }
    if (req.role === "guardian") {
      return { guardianId: BigInt(req.userId), actorType: "guardian" };
    }
  } catch {
    return null;
  }

  return typeof req.userId === "string"
    ? { userId: req.userId, actorType: "admin" }
    : null;
};

/**
 * Records every signed-in request in the audit log.
 *
 * Handlers that matter already write a detailed entry (student_deleted,
 * role_created, ...). For every other request, such as viewing a list, one
 * entry is written after the response is sent: who, which route, the outcome
 * and how long it took. A request that already wrote a detailed entry is not
 * recorded twice. Request bodies and query values are never stored.
 *
 * Must be registered before the routes, after the request id is assigned.
 */
export const auditTrail = (req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();

  runWithAuditContext(req, () => {
    const context = getAuditContext();

    res.on("finish", () => {
      if (!context || context.audited) return;

      const actor = actorFromRequest(req);
      if (!actor) return;

      const route = routePath(req);
      const action = ROUTE_ACTIONS[`${req.method} ${route}`] ?? requestAction(req.method);

      // Re-enter the request's context so the row gets its IP, route and request id
      runWithAuditContext(req, () =>
        createAuditLog(prisma, {
          data: {
            ...actor,
            action,
            result: res.statusCode < 400 ? "success" : "failure",
            status: `${req.method} ${route} ${res.statusCode}`,
            metadata: {
              statusCode: res.statusCode,
              durationMs: Date.now() - startedAt,
            },
          },
        }),
      ).catch((error: unknown) => {
        // Never let audit logging break or crash a request that already finished
        console.error("[audit] failed to record request", error);
      });
    });

    next();
  });
};

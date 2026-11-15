import { AsyncLocalStorage } from "async_hooks";

import { Request } from "express";

/**
 * Per-request state shared with the audit log writer, so a log call deep in a
 * service does not need the request passed down to record the IP, device,
 * route and request id, and so the request-level audit trail knows whether a
 * detailed entry was already written for this request.
 */
interface AuditRequestContext {
  req: Request;
  /** Set once any audit row is written during the request */
  audited: boolean;
}

const storage = new AsyncLocalStorage<AuditRequestContext>();

export const runWithAuditContext = <T>(req: Request, fn: () => T): T =>
  storage.run({ req, audited: false }, fn);

export const getAuditContext = (): AuditRequestContext | undefined =>
  storage.getStore();

export const markAudited = (): void => {
  const context = storage.getStore();
  if (context) context.audited = true;
};

/**
 * The client's IP address. req.ip honours the app's "trust proxy" setting, so
 * X-Forwarded-For is only believed for the configured number of proxy hops
 * instead of whatever the client sends. IPv4-mapped IPv6 addresses
 * ("::ffff:1.2.3.4") are reduced to plain IPv4, and the result always fits the
 * 45-character ip_address column.
 */
export const clientIp = (req: Request): string | undefined => {
  const raw = req.ip ?? req.socket?.remoteAddress;
  if (!raw) return undefined;
  const ip = raw.startsWith("::ffff:") ? raw.slice("::ffff:".length) : raw;
  return ip.slice(0, 45);
};

/** The matched route pattern (e.g. /api/v1/admin/students/:studentId), never raw IDs or query strings. */
export const routePath = (req: Request): string => {
  const path = req.route?.path
    ? `${req.baseUrl}${typeof req.route.path === "string" ? req.route.path : ""}`
    : req.originalUrl.split("?")[0];
  return path.slice(0, 255);
};

/** Request details recorded on every audit row written during a request. */
export const requestAuditFields = (): {
  ipAddress?: string;
  userAgent?: string;
  httpMethod?: string;
  path?: string;
  requestId?: string;
} => {
  const context = storage.getStore();
  if (!context) return {};

  const { req } = context;
  const userAgent = req.headers["user-agent"];

  return {
    ipAddress: clientIp(req),
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : undefined,
    httpMethod: req.method,
    path: routePath(req),
    requestId: req.requestId?.slice(0, 100),
  };
};

/** The business in the current request's token, if any. */
export const tokenBusinessId = (): bigint | undefined => {
  const businessId = storage.getStore()?.req.businessId;
  if (businessId === undefined || businessId === null) return undefined;
  try {
    const value = BigInt(businessId);
    return value > 0n ? value : undefined;
  } catch {
    return undefined;
  }
};

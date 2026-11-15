import { Request, Response } from "express";

import { AdminActor } from "../../interfaces/admin.interfaces";
import {
  listAccountAuditLogs,
  listAdminAuditLogs,
  listBusinessAuditLogs,
  listOwnAuditLogs,
} from "../../services/auditLog.service";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { successResponse } from "../../utils/response.util";
import {
  ListAccountAuditLogsQuery,
  ListAuditLogsQuery,
  ListOwnAuditLogsQuery,
} from "../../validations/auditLog.schema";

// requireBusinessContext has already taken the business ID from the token
const getActor = (req: Request): AdminActor => ({
  userId: req.userId as string,
  businessId: req.businessId as bigint,
  ip: extractRequestMetadata(req).ip,
});

/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLog:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 1042 }
 *         createdAt: { type: string, format: date-time }
 *         result: { type: string, enum: [success, failure, blocked] }
 *         status: { type: string, description: The original log message, example: "student_deleted" }
 *         actorType: { type: string, enum: [admin, student, guardian, anonymous, system], description: Who performed the action }
 *         action: { type: string, description: Fixed action code, example: student.deleted }
 *         targetType: { type: string, nullable: true, description: What the action was performed on, example: student }
 *         targetId: { type: string, nullable: true, example: "10" }
 *         userAgent: { type: string, nullable: true }
 *         httpMethod: { type: string, nullable: true, example: DELETE }
 *         path: { type: string, nullable: true, example: "/api/v1/admin/students/:studentId" }
 *         requestId: { type: string, nullable: true }
 *         metadata: { type: object, nullable: true, description: Extra details such as a reason or status code }
 *         ipAddress: { type: string, nullable: true }
 *         businessId: { type: integer, nullable: true }
 *         userId: { type: string, format: uuid, nullable: true, description: The administrator involved }
 *         studentId: { type: integer, nullable: true }
 *         guardianId: { type: integer, nullable: true }
 *         user:
 *           type: object
 *           nullable: true
 *           properties: { id: { type: string }, firstName: { type: string }, lastName: { type: string }, email: { type: string } }
 *         students:
 *           type: object
 *           nullable: true
 *           properties: { id: { type: integer }, firstName: { type: string }, lastName: { type: string }, registrationNumber: { type: string } }
 *         guardians:
 *           type: object
 *           nullable: true
 *           properties: { id: { type: integer }, firstName: { type: string }, lastName: { type: string } }
 */

/**
 * @swagger
 * /api/v1/admin/audit-logs:
 *   get:
 *     summary: View audit logs for everyone in your business
 *     description: |
 *       Returns the activity of every administrator, student and guardian in the
 *       business named in your access token, newest first. Logs from other
 *       businesses are never returned. Requires the admin.audit_logs.view_all
 *       permission. Each call is itself recorded in the audit log.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: actorType, schema: { type: string, enum: [admin, student, guardian] } }
 *       - { in: query, name: result, schema: { type: string, enum: [success, failure, blocked] } }
 *       - { in: query, name: action, schema: { type: string }, description: An exact action code, or a whole area such as auth.*, example: student.blocked }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *     responses:
 *       200:
 *         description: Audit logs fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Audit logs fetched successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs: { type: array, items: { $ref: '#/components/schemas/AuditLog' } }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: No business in the token, or missing admin.audit_logs.view_all
 */
export const listAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listBusinessAuditLogs(
    getActor(req),
    req.query as unknown as ListAuditLogsQuery,
  );
  successResponse(res, "Audit logs fetched successfully", result);
};

/**
 * @swagger
 * /api/v1/admin/audit-logs/{userId}:
 *   get:
 *     summary: View one administrator's audit logs
 *     description: |
 *       Returns what one administrator in your business did. Returns an empty list
 *       if the administrator is not in your business. Requires admin.audit_logs.view_all.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: result, schema: { type: string, enum: [success, failure, blocked] } }
 *       - { in: query, name: action, schema: { type: string }, description: An exact action code, or a whole area such as auth.*, example: auth.login_failed }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Audit logs fetched }
 *       400: { description: Invalid path or query parameters }
 *       401: { description: Unauthorized - Invalid or missing access token }
 *       403: { description: No business in the token, or missing admin.audit_logs.view_all }
 *
 * /api/v1/admin/audit-logs/students/{studentId}:
 *   get:
 *     summary: View one student's audit logs
 *     description: |
 *       Returns what one student in your business did, such as logins and password
 *       changes. Add include=received to also see what administrators did to the
 *       student (created, updated, blocked, ...). Requires admin.audit_logs.view_all.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: studentId, required: true, schema: { type: integer } }
 *       - { in: query, name: include, schema: { type: string, enum: [received] }, description: Also return what administrators did to this account }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: result, schema: { type: string, enum: [success, failure, blocked] } }
 *       - { in: query, name: action, schema: { type: string }, description: An exact action code, or a whole area such as auth.*, example: auth.login_failed }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Audit logs fetched }
 *       400: { description: Invalid path or query parameters }
 *       401: { description: Unauthorized - Invalid or missing access token }
 *       403: { description: No business in the token, or missing admin.audit_logs.view_all }
 *
 * /api/v1/admin/audit-logs/guardians/{guardianId}:
 *   get:
 *     summary: View one guardian's audit logs
 *     description: |
 *       Returns what one guardian in your business did. Add include=received to also
 *       see what administrators did to the guardian. Requires admin.audit_logs.view_all.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: guardianId, required: true, schema: { type: integer } }
 *       - { in: query, name: include, schema: { type: string, enum: [received] }, description: Also return what administrators did to this account }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: result, schema: { type: string, enum: [success, failure, blocked] } }
 *       - { in: query, name: action, schema: { type: string }, description: An exact action code, or a whole area such as auth.*, example: auth.login_failed }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Audit logs fetched }
 *       400: { description: Invalid path or query parameters }
 *       401: { description: Unauthorized - Invalid or missing access token }
 *       403: { description: No business in the token, or missing admin.audit_logs.view_all }
 */
export const listAdminAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listAdminAuditLogs(
    getActor(req),
    req.params.userId as string,
    req.query as unknown as ListOwnAuditLogsQuery,
  );
  successResponse(res, "Audit logs fetched successfully", result);
};

export const listStudentAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { studentId } = req.params as unknown as { studentId: bigint };
  const result = await listAccountAuditLogs(
    getActor(req),
    { studentId },
    req.query as unknown as ListAccountAuditLogsQuery,
  );
  successResponse(res, "Audit logs fetched successfully", result);
};

export const listGuardianAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { guardianId } = req.params as unknown as { guardianId: bigint };
  const result = await listAccountAuditLogs(
    getActor(req),
    { guardianId },
    req.query as unknown as ListAccountAuditLogsQuery,
  );
  successResponse(res, "Audit logs fetched successfully", result);
};

/**
 * @swagger
 * /api/v1/admin/audit-logs/me:
 *   get:
 *     summary: View your own audit log activity
 *     description: |
 *       Returns your own activity within the business named in your access token,
 *       newest first. Requires the admin.audit_logs.view_own permission.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: result, schema: { type: string, enum: [success, failure, blocked] } }
 *       - { in: query, name: action, schema: { type: string }, description: An exact action code, or a whole area such as auth.*, example: auth.login_failed }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *     responses:
 *       200:
 *         description: Your audit logs fetched
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: No business in the token, or missing admin.audit_logs.view_own
 */
export const listOwnAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listOwnAuditLogs(
    getActor(req),
    req.query as unknown as ListOwnAuditLogsQuery,
  );
  successResponse(res, "Your audit logs fetched successfully", result);
};

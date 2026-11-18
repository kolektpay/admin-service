import { Request, Response } from "express";

import { AdminActor } from "../../interfaces/admin.interfaces";
import {
  listAdminsAuditLogs,
  listBusinessAuditLogs,
  listGuardiansAuditLogs,
  listOwnAuditLogs,
  listStudentsAuditLogs,
} from "../../services/auditLog.service";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { successResponse } from "../../utils/response.util";
import {
  ListAdminsAuditLogsQuery,
  ListAuditLogsQuery,
  ListGuardiansAuditLogsQuery,
  ListOwnAuditLogsQuery,
  ListStudentsAuditLogsQuery,
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
 *       - { in: query, name: actorType, schema: { type: string, enum: [admin, student, guardian, anonymous, system] }, description: Only rows where this kind of account acted }
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
 * /api/v1/admin/audit-logs/admins:
 *   get:
 *     summary: View administrators' audit logs
 *     description: |
 *       Returns what administrators in your business did, newest first. Pass userId
 *       for one administrator; leave it out for every administrator. Returns an
 *       empty list if the administrator is not in your business.
 *       Requires admin.audit_logs.view_all.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: userId, schema: { type: string, format: uuid }, description: One administrator. Omit for all administrators }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: result, schema: { type: string, enum: [success, failure, blocked] } }
 *       - { in: query, name: action, schema: { type: string }, description: An exact action code, or a whole area such as auth.*, example: auth.login_failed }
 *       - { in: query, name: from, schema: { type: string, format: date-time }, description: "On or after this time. A date such as 2026-11-01 starts at midnight UTC" }
 *       - { in: query, name: to, schema: { type: string, format: date-time }, description: "On or before this time. A date such as 2026-11-14 includes that whole day (UTC)" }
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
 *       400: { description: Invalid query parameters }
 *       401: { description: Unauthorized - Invalid or missing access token }
 *       403: { description: No business in the token, or missing admin.audit_logs.view_all }
 *
 * /api/v1/admin/audit-logs/students:
 *   get:
 *     summary: View students' audit logs
 *     description: |
 *       Returns what students in your business did, such as logins and password
 *       changes, newest first. Pass studentId for one student; leave it out for every
 *       student. Add include=received to also see what administrators and guardians
 *       did to the student(s) (created, updated, blocked, ...).
 *       Requires admin.audit_logs.view_all.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: studentId, schema: { type: integer }, description: One student. Omit for all students }
 *       - { in: query, name: include, schema: { type: string, enum: [received] }, description: Also return what others did to the student(s) }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: result, schema: { type: string, enum: [success, failure, blocked] } }
 *       - { in: query, name: action, schema: { type: string }, description: An exact action code, or a whole area such as auth.*, example: auth.login_failed }
 *       - { in: query, name: from, schema: { type: string, format: date-time }, description: "On or after this time. A date such as 2026-11-01 starts at midnight UTC" }
 *       - { in: query, name: to, schema: { type: string, format: date-time }, description: "On or before this time. A date such as 2026-11-14 includes that whole day (UTC)" }
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
 *       400: { description: Invalid query parameters }
 *       401: { description: Unauthorized - Invalid or missing access token }
 *       403: { description: No business in the token, or missing admin.audit_logs.view_all }
 *
 * /api/v1/admin/audit-logs/guardians:
 *   get:
 *     summary: View guardians' audit logs
 *     description: |
 *       Returns what guardians in your business did, newest first. Pass guardianId
 *       for one guardian; leave it out for every guardian. Add include=received to
 *       also see what administrators did to the guardian(s).
 *       Requires admin.audit_logs.view_all.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: guardianId, schema: { type: integer }, description: One guardian. Omit for all guardians }
 *       - { in: query, name: include, schema: { type: string, enum: [received] }, description: Also return what administrators did to the guardian(s) }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: result, schema: { type: string, enum: [success, failure, blocked] } }
 *       - { in: query, name: action, schema: { type: string }, description: An exact action code, or a whole area such as auth.*, example: auth.login_failed }
 *       - { in: query, name: from, schema: { type: string, format: date-time }, description: "On or after this time. A date such as 2026-11-01 starts at midnight UTC" }
 *       - { in: query, name: to, schema: { type: string, format: date-time }, description: "On or before this time. A date such as 2026-11-14 includes that whole day (UTC)" }
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
 *       400: { description: Invalid query parameters }
 *       401: { description: Unauthorized - Invalid or missing access token }
 *       403: { description: No business in the token, or missing admin.audit_logs.view_all }
 */
export const listAdminsAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listAdminsAuditLogs(
    getActor(req),
    req.query as unknown as ListAdminsAuditLogsQuery,
  );
  successResponse(res, "Audit logs fetched successfully", result);
};

export const listStudentsAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listStudentsAuditLogs(
    getActor(req),
    req.query as unknown as ListStudentsAuditLogsQuery,
  );
  successResponse(res, "Audit logs fetched successfully", result);
};

export const listGuardiansAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listGuardiansAuditLogs(
    getActor(req),
    req.query as unknown as ListGuardiansAuditLogsQuery,
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

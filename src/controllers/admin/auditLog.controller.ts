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
 *       description: One line of the Audit Logs table, ready to display
 *       properties:
 *         id: { type: integer, example: 1042 }
 *         createdAt: { type: string, format: date-time }
 *         actor:
 *           type: object
 *           description: Actor / User column
 *           properties:
 *             type: { type: string, enum: [admin, student, guardian, anonymous, system] }
 *             id: { type: string, nullable: true, description: uuid for an administrator, numeric id for a student or guardian }
 *             name: { type: string, example: Jane Smith, description: "\"Unknown (102.89.1.4)\" for a sign-in to no account" }
 *             role: { type: string, nullable: true, example: Finance Manager, description: The administrator's role(s) in this business; Student or Guardian otherwise }
 *         action:
 *           type: object
 *           description: Action Performed badge
 *           properties:
 *             code: { type: string, example: role.created, description: Fixed code, usable as the action filter }
 *             label: { type: string, example: Created Role }
 *         target:
 *           type: object
 *           nullable: true
 *           description: Shown after the arrow
 *           properties:
 *             type: { type: string, example: role, description: "student, guardian, admin, role, subclass, or an area such as system, wallet, request" }
 *             id: { type: string, nullable: true, example: "7" }
 *             name: { type: string, example: Finance Manager, description: "A person or record name, or System / Student Portal / Guardian Portal for sign-ins" }
 *         status: { type: string, enum: [success, failed, blocked] }
 *         statusLabel: { type: string, enum: [Success, Failed, Blocked] }
 *         details:
 *           type: object
 *           description: Extra information for a detail view
 *           properties:
 *             description: { type: string, nullable: true, description: The original log message }
 *             ipAddress: { type: string, nullable: true }
 *             userAgent: { type: string, nullable: true }
 *             httpMethod: { type: string, nullable: true, example: DELETE }
 *             path: { type: string, nullable: true, example: "/api/v1/admin/students/:studentId" }
 *             requestId: { type: string, nullable: true }
 *             metadata: { type: object, nullable: true }
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
 *       - { in: query, name: search, schema: { type: string, maxLength: 100 }, description: "The search box: matches the actor's or the target's name" }
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
 *       The Admin Logs tab. Returns what administrators in your business did, newest
 *       first, except actions on a student or guardian, which the Student and
 *       Guardian tabs show (GET /audit-logs?actorType=admin returns both). Pass
 *       userId for one administrator; leave it out for every administrator.
 *       Returns an empty list if the administrator is not in your business.
 *       Requires admin.audit_logs.view_all.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: userId, schema: { type: string, format: uuid }, description: One administrator. Omit for all administrators }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: search, schema: { type: string, maxLength: 100 }, description: "The search box: matches the actor's or the target's name" }
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
 *       The Student Logs tab. Returns what students in your business did (logins,
 *       password changes, ...) and what administrators and guardians did to them
 *       (created, updated, blocked, ...), newest first. Pass studentId for one
 *       student; leave it out for every student. scope=own leaves out what others did.
 *       Requires admin.audit_logs.view_all.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: studentId, schema: { type: integer }, description: One student. Omit for all students }
 *       - { in: query, name: scope, schema: { type: string, enum: [all, own], default: all }, description: "all: what the student(s) did plus what others did to them. own: only what they did" }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: search, schema: { type: string, maxLength: 100 }, description: "The search box: matches the actor's or the target's name" }
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
 *       The Guardian Logs tab. Returns what guardians in your business did and what
 *       administrators did to them, newest first. Pass guardianId for one guardian;
 *       leave it out for every guardian. scope=own leaves out what others did.
 *       Requires admin.audit_logs.view_all.
 *     tags:
 *       - Audit Logs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: guardianId, schema: { type: integer }, description: One guardian. Omit for all guardians }
 *       - { in: query, name: scope, schema: { type: string, enum: [all, own], default: all }, description: "all: what the guardian(s) did plus what administrators did to them. own: only what they did" }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: search, schema: { type: string, maxLength: 100 }, description: "The search box: matches the actor's or the target's name" }
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
 *       - { in: query, name: search, schema: { type: string, maxLength: 100 }, description: "The search box: matches the actor's or the target's name" }
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

import { Request, Response } from "express";

import { AdminActor } from "../../interfaces/admin.interfaces";
import {
  assignStudentToSubclass,
  bulkTransferStudents,
  getStudentAssignment,
} from "../../services/classAssignment.service";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { successResponse } from "../../utils/response.util";
import {
  AssignStudentInput,
  BulkTransferStudentsInput,
} from "../../validations/classManagement.schema";

// Business and actor come from the JWT (requirePermission guarantees both are present)
const getActor = (req: Request): AdminActor => ({
  userId: req.userId as string,
  businessId: BigInt(req.businessId!),
  ip: extractRequestMetadata(req).ip,
});

const studentIdParam = (req: Request) => req.params.studentId as unknown as bigint;

/**
 * @swagger
 * components:
 *   schemas:
 *     StudentClassAssignment:
 *       type: object
 *       properties:
 *         student:
 *           type: object
 *           properties:
 *             id: { type: integer, example: 501 }
 *             firstName: { type: string, example: Ada }
 *             middleName: { type: string, nullable: true }
 *             lastName: { type: string, example: Obi }
 *             registrationNumber: { type: string, nullable: true, example: KOL/2026/001 }
 *             status: { type: string, example: active }
 *             updatedAt: { type: string, format: date-time }
 *         class:
 *           type: object
 *           properties:
 *             id: { type: integer, example: 10 }
 *             name: { type: string, example: JSS 1 }
 *             category: { type: string, enum: [normal, ube] }
 *         subclass:
 *           type: object
 *           properties:
 *             id: { type: integer, example: 12 }
 *             name: { type: string, example: JSS 1A }
 */

/**
 * @swagger
 * /api/v1/admin/class-assignments/students/{studentId}:
 *   get:
 *     summary: Get a student's current class and subclass
 *     description: Requires the admin.student_management.read_student permission.
 *     tags:
 *       - Class Assignments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: studentId, required: true, schema: { type: integer }, example: 501 }
 *     responses:
 *       200:
 *         description: Assignment fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Student class assignment fetched successfully }
 *                 data: { $ref: '#/components/schemas/StudentClassAssignment' }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Student not found in your business (STUDENT_NOT_FOUND)
 */
export const getStudentAssignmentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const assignment = await getStudentAssignment(studentIdParam(req), getActor(req).businessId);
  successResponse(res, "Student class assignment fetched successfully", assignment);
};

/**
 * @swagger
 * /api/v1/admin/class-assignments/students/{studentId}:
 *   put:
 *     summary: Assign or transfer a student to a subclass
 *     description: |
 *       A student belongs to exactly one subclass, so this replaces their current one.
 *       If another request changes the student's subclass at the same time, this one
 *       fails with ASSIGNMENT_CONFLICT rather than overwriting it.
 *       Requires the admin.class_management.assign_student permission.
 *     tags:
 *       - Class Assignments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: studentId, required: true, schema: { type: integer }, example: 501 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subclassId]
 *             properties:
 *               subclassId: { type: integer, example: 13 }
 *     responses:
 *       200:
 *         description: Student assigned — returns the new assignment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Student assigned to subclass successfully }
 *                 data: { $ref: '#/components/schemas/StudentClassAssignment' }
 *       400:
 *         description: Validation failed (VALIDATION_ERROR)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Student (STUDENT_NOT_FOUND) or subclass (SUBCLASS_NOT_FOUND) not found in your business
 *       409:
 *         description: Already in this subclass (STUDENT_ALREADY_ASSIGNED), or changed concurrently (ASSIGNMENT_CONFLICT)
 */
export const assignStudentHandler = async (req: Request, res: Response): Promise<void> => {
  const assignment = await assignStudentToSubclass(
    studentIdParam(req),
    req.body as AssignStudentInput,
    getActor(req),
  );
  successResponse(res, "Student assigned to subclass successfully", assignment);
};

/**
 * @swagger
 * /api/v1/admin/class-assignments/transfers:
 *   post:
 *     summary: Move students from one subclass to another
 *     description: |
 *       For end-of-session promotion, e.g. every student in JSS 1A to JSS 2A.
 *       Without studentIds, every student in the source subclass moves; with them, only
 *       those listed. Graduated and withdrawn students are never moved. The move is a single
 *       all-or-nothing update, and students who are not in the source subclass when it runs
 *       are skipped and listed with a reason rather than failing the request.
 *       Requires the admin.class_management.assign_student permission.
 *     tags:
 *       - Class Assignments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sourceSubclassId, destinationSubclassId]
 *             properties:
 *               sourceSubclassId: { type: integer, example: 12 }
 *               destinationSubclassId: { type: integer, example: 15 }
 *               studentIds:
 *                 type: array
 *                 items: { type: integer }
 *                 minItems: 1
 *                 maxItems: 1000
 *                 description: Omit to move every eligible student. Duplicates are ignored
 *                 example: [501, 502]
 *     responses:
 *       200:
 *         description: Transfer completed
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Students transferred successfully
 *               data:
 *                 source: { id: 12, name: JSS 1A, class: { id: 10, name: JSS 1 } }
 *                 destination: { id: 15, name: JSS 2A, class: { id: 11, name: JSS 2 } }
 *                 movedCount: 1
 *                 movedStudentIds: [501]
 *                 skippedCount: 1
 *                 skipped:
 *                   - { studentId: 502, reason: not_in_source_subclass }
 *       400:
 *         description: Validation failed, e.g. source and destination are the same (VALIDATION_ERROR)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Source or destination subclass not found in your business (SUBCLASS_NOT_FOUND)
 */
export const bulkTransferStudentsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await bulkTransferStudents(
    req.body as BulkTransferStudentsInput,
    getActor(req),
  );
  successResponse(res, "Students transferred successfully", result);
};

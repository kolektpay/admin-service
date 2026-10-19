import { Request, Response } from "express";

import {
  StudentActor,
  StudentStatusChangeResult,
} from "../../interfaces/student.interfaces";
import {
  blockStudent,
  bulkCreateStudents,
  deleteStudentById,
  listStudents,
  unblockStudent,
  updateStudentById,
} from "../../services/student.service";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { successResponse } from "../../utils/response.util";
import { ListStudentsQuery } from "../../validations/studentManagement.schema";

// Business and actor come from the JWT (requirePermission guarantees both are present)
const getBusinessId = (req: Request): bigint => BigInt(req.businessId!);

const getActor = (req: Request): StudentActor => ({
  userId: req.userId as string,
  ip: extractRequestMetadata(req).ip,
});

const getStudentId = (req: Request): bigint =>
  req.params.studentId as unknown as bigint;

/**
 * @swagger
 * /api/v1/admin/students:
 *   get:
 *     summary: List students with pagination, filtering and sorting
 *     description: |
 *       Returns students belonging to the authenticated user's business.
 *       Filters are combined with AND. Date filters apply to the student's creation date
 *       (UTC calendar days, both ends inclusive).
 *       Requires the admin.student_management.read_student permission.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
 *       - { in: query, name: name, schema: { type: string }, description: "Matches first, middle or last name (every word must match)", example: John }
 *       - { in: query, name: regNo, schema: { type: string }, description: Exact registration number, example: STU001 }
 *       - { in: query, name: class, schema: { type: string }, description: Class name (case-insensitive), example: JSS1 }
 *       - { in: query, name: classId, schema: { type: integer } }
 *       - { in: query, name: subclassId, schema: { type: integer } }
 *       - { in: query, name: age, schema: { type: integer }, description: Exact age (cannot be combined with minAge/maxAge) }
 *       - { in: query, name: minAge, schema: { type: integer } }
 *       - { in: query, name: maxAge, schema: { type: integer } }
 *       - { in: query, name: startDate, schema: { type: string, format: date }, example: "2026-01-01" }
 *       - { in: query, name: endDate, schema: { type: string, format: date }, example: "2026-10-01" }
 *       - { in: query, name: status, schema: { type: string, enum: [active, inactive, suspended, graduated, withdrawn, blocked, pending] } }
 *       - { in: query, name: search, schema: { type: string }, description: Partial match on name or registration number }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, firstName, lastName, registrationNumber, age], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200:
 *         description: Students fetched (data.students and data.pagination)
 *       400:
 *         description: Invalid query parameters (code VALIDATION_ERROR, with field details)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 */
export const listStudentsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listStudents(
    getBusinessId(req),
    req.query as unknown as ListStudentsQuery,
  );
  successResponse(res, "Students fetched successfully", result);
};

/**
 * @swagger
 * /api/v1/admin/students:
 *   post:
 *     summary: Create a single student
 *     description: |
 *       Same behaviour and validation as POST /api/v1/admin/students/bulk, for one student.
 *       The request body is a single student record (not wrapped in a "students" array).
 *       Requires the admin.student_management.create_student permission.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, phoneNumber, gender, dateOfBirth, age, address, subclassId, guardianEmail, city]
 *             properties:
 *               firstName: { type: string, example: Ngozi }
 *               middleName: { type: string, nullable: true }
 *               lastName: { type: string, example: Adetunji }
 *               email: { type: string, format: email, example: ngozi.adetunji@example.com }
 *               phoneNumber: { type: string, example: "+2348031110021" }
 *               registrationNumber: { type: string, nullable: true, example: STU001 }
 *               gender: { type: string, example: Female }
 *               dateOfBirth: { type: string, format: date, example: "2013-09-14" }
 *               age: { type: integer, example: 13 }
 *               address: { type: string, example: "Ikeja, Lagos" }
 *               avatar: { type: string, format: uri, nullable: true }
 *               subclassId: { type: integer, example: 3 }
 *               guardianEmail: { type: string, format: email, description: Email of an existing guardian in your business, example: chidi.adetunji@example.com }
 *               city: { type: string, description: Used for wallet creation only, example: Lagos }
 *               alias: { type: string, description: Optional wallet alias }
 *     responses:
 *       201:
 *         description: Student created (data.student, plus data.walletProvisioning for wallet status)
 *       400:
 *         description: Validation failed, guardian not assignable, or subclass not found
 *       409:
 *         description: Email, phone number or registration number already in use
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 */
export const createStudentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { students, walletProvisioning } = await bulkCreateStudents(
    [req.body],
    getBusinessId(req),
    getActor(req),
  );

  const message =
    walletProvisioning.pending.length === 0
      ? "Student created successfully"
      : "Student created; wallet is pending and can be retried";

  successResponse(
    res,
    message,
    { student: students[0], walletProvisioning },
    201,
  );
};

/**
 * @swagger
 * /api/v1/admin/students/bulk:
 *   post:
 *     summary: Create up to 100 students in one atomic batch
 *     description: |
 *       Creates the students, links each to its guardian, records password history,
 *       queues temporary-password emails and writes audit logs in a single database
 *       transaction. If any record fails, nothing is created.
 *       Wallets are then requested from the payment service. A wallet failure does not undo
 *       the students; those students are listed in data.walletProvisioning.pending and can be
 *       retried with POST /api/v1/admin/wallet/student-wallets.
 *       Requires the admin.student_management.create_student permission.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [students]
 *             properties:
 *               students:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required: [firstName, lastName, email, phoneNumber, gender, dateOfBirth, age, address, subclassId, guardianEmail, city]
 *                   properties:
 *                     firstName: { type: string, example: Ngozi }
 *                     middleName: { type: string, nullable: true }
 *                     lastName: { type: string, example: Adetunji }
 *                     email: { type: string, format: email, example: ngozi.adetunji@example.com }
 *                     phoneNumber: { type: string, example: "+2348031110021" }
 *                     registrationNumber: { type: string, nullable: true, example: STU001 }
 *                     gender: { type: string, example: Female }
 *                     dateOfBirth: { type: string, format: date, example: "2013-09-14" }
 *                     age: { type: integer, example: 13 }
 *                     address: { type: string, example: "Ikeja, Lagos" }
 *                     avatar: { type: string, format: uri, nullable: true }
 *                     subclassId: { type: integer, example: 3 }
 *                     guardianEmail: { type: string, format: email, description: Email of an existing guardian in your business, example: chidi.adetunji@example.com }
 *                     city: { type: string, description: Used for wallet creation only, example: Lagos }
 *                     alias: { type: string, description: Optional wallet alias }
 *     responses:
 *       201:
 *         description: Students created (see data.walletProvisioning for wallet status)
 *       400:
 *         description: Validation failed, guardian not assignable, or subclass not found
 *       409:
 *         description: Duplicate email, phone number or registration number (in the request or already in use)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       429:
 *         description: Too many bulk requests
 */
export const bulkCreateStudentsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { students, walletProvisioning } = await bulkCreateStudents(
    req.body.students,
    getBusinessId(req),
    getActor(req),
  );

  const message =
    walletProvisioning.pending.length === 0
      ? `${students.length} student(s) created successfully`
      : `${students.length} student(s) created; ${walletProvisioning.pending.length} wallet(s) are pending and can be retried`;

  successResponse(
    res,
    message,
    { createdCount: students.length, students, walletProvisioning },
    201,
  );
};

/**
 * @swagger
 * /api/v1/admin/students/{studentId}:
 *   patch:
 *     summary: Update a student's details
 *     description: |
 *       Updates only the supplied fields. Status, password, wallet and audit fields cannot be
 *       changed here (use the block/unblock endpoints for status). Unknown fields are rejected.
 *       Requires the admin.student_management.update_student permission.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             additionalProperties: false
 *             properties:
 *               firstName: { type: string }
 *               middleName: { type: string, nullable: true }
 *               lastName: { type: string }
 *               email: { type: string, format: email }
 *               phoneNumber: { type: string }
 *               registrationNumber: { type: string, nullable: true }
 *               gender: { type: string }
 *               dateOfBirth: { type: string, format: date }
 *               age: { type: integer }
 *               address: { type: string }
 *               avatar: { type: string, format: uri, nullable: true }
 *               subclassId: { type: integer }
 *     responses:
 *       200:
 *         description: Student updated
 *       400:
 *         description: Validation failed or subclass not found
 *       404:
 *         description: Student not found
 *       409:
 *         description: Email, phone number or registration number already in use
 */
export const updateStudentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const student = await updateStudentById(
    getStudentId(req),
    getBusinessId(req),
    req.body,
    getActor(req),
  );
  successResponse(res, "Student updated successfully", student);
};

const sendStatusChangeResponse = (
  res: Response,
  result: StudentStatusChangeResult,
  changedMessage: string,
  unchangedMessage: string,
): void =>
  successResponse(
    res,
    result.changed ? changedMessage : unchangedMessage,
    result,
  );

/**
 * @swagger
 * /api/v1/admin/students/{studentId}/block:
 *   patch:
 *     summary: Block a student
 *     description: |
 *       Sets the student's status to "blocked" and records the reason, actor and time in the
 *       audit log. Blocking an already-blocked student succeeds with data.changed = false.
 *       Only active, pending or inactive students can be blocked.
 *       Requires the admin.student_management.update_student permission.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 3, maxLength: 255, example: Fraudulent payment activity }
 *     responses:
 *       200:
 *         description: Student blocked (or already blocked)
 *       404:
 *         description: Student not found
 *       409:
 *         description: Student's current status cannot be blocked, or status changed concurrently
 */
export const blockStudentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await blockStudent(
    getStudentId(req),
    getBusinessId(req),
    req.body.reason,
    getActor(req),
  );
  sendStatusChangeResponse(
    res,
    result,
    "Student blocked successfully",
    "Student is already blocked",
  );
};

/**
 * @swagger
 * /api/v1/admin/students/{studentId}/unblock:
 *   patch:
 *     summary: Unblock a student
 *     description: |
 *       Restores a blocked student to "active" and resets their failed-login counter.
 *       Unblocking a student who is not blocked succeeds with data.changed = false.
 *       Requires the admin.student_management.update_student permission.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, minLength: 3, maxLength: 255 }
 *     responses:
 *       200:
 *         description: Student unblocked (or was not blocked)
 *       404:
 *         description: Student not found
 *       409:
 *         description: Status changed concurrently
 */
export const unblockStudentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await unblockStudent(
    getStudentId(req),
    getBusinessId(req),
    req.body?.reason,
    getActor(req),
  );
  sendStatusChangeResponse(
    res,
    result,
    "Student unblocked successfully",
    "Student is not blocked",
  );
};

/**
 * @swagger
 * /api/v1/admin/students/{studentId}:
 *   delete:
 *     summary: Delete a student
 *     description: |
 *       Soft deletes the student. Their email, phone number and registration number stay
 *       reserved and cannot be reused for another student.
 *       Requires the admin.student_management.delete_student permission.
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Student deleted
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Student not found (or already deleted)
 */
export const deleteStudentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await deleteStudentById(getStudentId(req), getBusinessId(req), getActor(req));
  successResponse(res, "Student deleted successfully");
};

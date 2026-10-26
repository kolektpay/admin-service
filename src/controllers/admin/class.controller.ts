import { Request, Response } from "express";

import { AdminActor } from "../../interfaces/admin.interfaces";
import {
  createSubclass,
  deleteSubclass,
  getClass,
  getSubclass,
  listClasses,
  listSubclasses,
  updateSubclass,
} from "../../services/class.service";
import { listSubclassStudents } from "../../services/classAssignment.service";
import { extractRequestMetadata } from "../../utils/request.metadata";
import { successResponse } from "../../utils/response.util";
import {
  CreateSubclassInput,
  ListClassesQuery,
  ListSubclassesQuery,
  ListSubclassStudentsQuery,
  UpdateSubclassInput,
} from "../../validations/classManagement.schema";

// Business and actor come from the JWT (requirePermission guarantees both are present)
const getActor = (req: Request): AdminActor => ({
  userId: req.userId as string,
  businessId: BigInt(req.businessId!),
  ip: extractRequestMetadata(req).ip,
});

const classIdParam = (req: Request) => req.params.classId as unknown as bigint;
const subclassIdParam = (req: Request) => req.params.subclassId as unknown as bigint;

/**
 * @swagger
 * components:
 *   schemas:
 *     ClassSubclass:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 12 }
 *         name: { type: string, example: JSS 1A }
 *         studentsCount: { type: integer, description: Active students in this subclass, example: 28 }
 *     Class:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 10 }
 *         name: { type: string, example: JSS 1 }
 *         category: { type: string, enum: [standardClass, technical, university, polytechnic, collegeOfEducation], example: standardClass }
 *         description: { type: string, nullable: true, example: Junior Secondary School year 1 }
 *         studentsCount: { type: integer, description: Active students across your business's subclasses, example: 84 }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         subclasses:
 *           type: array
 *           description: Your business's subclasses of this class; empty when you have none
 *           items: { $ref: '#/components/schemas/ClassSubclass' }
 *     Subclass:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 12 }
 *         name: { type: string, example: JSS 1A }
 *         classId: { type: integer, example: 10 }
 *         class:
 *           type: object
 *           properties:
 *             id: { type: integer, example: 10 }
 *             name: { type: string, example: JSS 1 }
 *         studentsCount: { type: integer, description: Active students in this subclass, example: 28 }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

// ==========================================
// Classes
// ==========================================

/**
 * @swagger
 * /api/v1/admin/classes:
 *   get:
 *     summary: List the global classes with your business's subclasses
 *     description: |
 *       Classes are shared by every business and managed by Kolekt, so they cannot be
 *       created, edited or deleted through the API. Each class lists only your business's
 *       subclasses. Requires the admin.class_management.read_class permission.
 *     tags:
 *       - Classes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
 *       - { in: query, name: search, schema: { type: string }, description: Case-insensitive partial match on class name or one of your subclass names, example: jss }
 *       - { in: query, name: category, schema: { type: string, enum: [standardClass, technical, university, polytechnic, collegeOfEducation] } }
 *       - { in: query, name: hasSubclasses, schema: { type: boolean }, description: Only classes where your business has (true) or has no (false) subclasses }
 *     responses:
 *       200:
 *         description: Classes fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Classes fetched successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     classes:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Class' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid query parameters (VALIDATION_ERROR)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 */
export const listClassesHandler = async (req: Request, res: Response): Promise<void> => {
  const result = await listClasses(
    getActor(req).businessId,
    req.query as unknown as ListClassesQuery,
  );
  successResponse(res, "Classes fetched successfully", result);
};

/**
 * @swagger
 * /api/v1/admin/classes/{classId}:
 *   get:
 *     summary: Get one class with your business's subclasses
 *     description: Requires the admin.class_management.read_class permission.
 *     tags:
 *       - Classes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: classId, required: true, schema: { type: integer }, example: 10 }
 *     responses:
 *       200:
 *         description: Class fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Class fetched successfully }
 *                 data: { $ref: '#/components/schemas/Class' }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Class not found (CLASS_NOT_FOUND)
 */
export const getClassHandler = async (req: Request, res: Response): Promise<void> => {
  const found = await getClass(classIdParam(req), getActor(req).businessId);
  successResponse(res, "Class fetched successfully", found);
};

// ==========================================
// Subclasses
// ==========================================

/**
 * @swagger
 * /api/v1/admin/subclasses:
 *   get:
 *     summary: List your business's subclasses
 *     description: Requires the admin.class_management.read_class permission.
 *     tags:
 *       - Subclasses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
 *       - { in: query, name: classId, schema: { type: integer }, description: Only subclasses of this class, example: 10 }
 *       - { in: query, name: search, schema: { type: string }, description: Case-insensitive partial match on subclass name, example: 1a }
 *     responses:
 *       200:
 *         description: Subclasses fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Subclasses fetched successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     subclasses:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Subclass' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid query parameters (VALIDATION_ERROR)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 */
export const listSubclassesHandler = async (req: Request, res: Response): Promise<void> => {
  const result = await listSubclasses(
    getActor(req).businessId,
    req.query as unknown as ListSubclassesQuery,
  );
  successResponse(res, "Subclasses fetched successfully", result);
};

/**
 * @swagger
 * /api/v1/admin/subclasses/{subclassId}:
 *   get:
 *     summary: Get one subclass with its parent class
 *     description: Requires the admin.class_management.read_class permission.
 *     tags:
 *       - Subclasses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: subclassId, required: true, schema: { type: integer }, example: 12 }
 *     responses:
 *       200:
 *         description: Subclass fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Subclass fetched successfully }
 *                 data: { $ref: '#/components/schemas/Subclass' }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Subclass not found in your business (SUBCLASS_NOT_FOUND)
 */
export const getSubclassHandler = async (req: Request, res: Response): Promise<void> => {
  const found = await getSubclass(subclassIdParam(req), getActor(req).businessId);
  successResponse(res, "Subclass fetched successfully", found);
};

/**
 * @swagger
 * /api/v1/admin/subclasses:
 *   post:
 *     summary: Create a subclass under a class
 *     description: |
 *       The name must not match (case-insensitively) another of your subclasses of the same class.
 *       Requires the admin.class_management.create_class permission.
 *     tags:
 *       - Subclasses
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classId, name]
 *             properties:
 *               classId: { type: integer, example: 10 }
 *               name: { type: string, maxLength: 50, example: JSS 1D }
 *     responses:
 *       201:
 *         description: Subclass created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Subclass created successfully }
 *                 data: { $ref: '#/components/schemas/Subclass' }
 *       400:
 *         description: Validation failed (VALIDATION_ERROR)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Parent class not found (CLASS_NOT_FOUND)
 *       409:
 *         description: The class already has a subclass with this name (SUBCLASS_NAME_TAKEN)
 */
export const createSubclassHandler = async (req: Request, res: Response): Promise<void> => {
  const created = await createSubclass(req.body as CreateSubclassInput, getActor(req));
  successResponse(res, "Subclass created successfully", created, 201);
};

/**
 * @swagger
 * /api/v1/admin/subclasses/{subclassId}:
 *   patch:
 *     summary: Rename a subclass or move it under another class
 *     description: |
 *       Moving a subclass moves its students with it. Your business must not already have
 *       a subclass with the same name in the new class. A subclass that
 *       payment items are targeted at cannot change class.
 *       Requires the admin.class_management.update_class permission.
 *     tags:
 *       - Subclasses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: subclassId, required: true, schema: { type: integer }, example: 12 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               name: { type: string, maxLength: 50, example: JSS 1 Gold }
 *               classId: { type: integer, example: 11 }
 *     responses:
 *       200:
 *         description: Subclass updated — returns the updated subclass
 *       400:
 *         description: Validation failed (VALIDATION_ERROR)
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Subclass not found in your business (SUBCLASS_NOT_FOUND), or new parent class not found (CLASS_NOT_FOUND)
 *       409:
 *         description: Name already used in the target class (SUBCLASS_NAME_TAKEN), or payment items prevent a class change (SUBCLASS_HAS_PAYMENT_ITEMS)
 */
export const updateSubclassHandler = async (req: Request, res: Response): Promise<void> => {
  const updated = await updateSubclass(
    subclassIdParam(req),
    req.body as UpdateSubclassInput,
    getActor(req),
  );
  successResponse(res, "Subclass updated successfully", updated);
};

/**
 * @swagger
 * /api/v1/admin/subclasses/{subclassId}:
 *   delete:
 *     summary: Delete a subclass
 *     description: |
 *       Refused while any student record (including removed students) is in it, or any
 *       payment item is targeted at it. Transfer the students first.
 *       Requires the admin.class_management.delete_class permission.
 *     tags:
 *       - Subclasses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: subclassId, required: true, schema: { type: integer }, example: 12 }
 *     responses:
 *       200:
 *         description: Subclass deleted
 *         content:
 *           application/json:
 *             example: { success: true, message: Subclass deleted successfully }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Subclass not found in your business (SUBCLASS_NOT_FOUND)
 *       409:
 *         description: Subclass still has students or payment items (SUBCLASS_IN_USE)
 */
export const deleteSubclassHandler = async (req: Request, res: Response): Promise<void> => {
  await deleteSubclass(subclassIdParam(req), getActor(req));
  successResponse(res, "Subclass deleted successfully");
};

/**
 * @swagger
 * /api/v1/admin/subclasses/{subclassId}/students:
 *   get:
 *     summary: List the students currently assigned to a subclass
 *     description: |
 *       Returns active (not removed) students, sorted by last name.
 *       Requires the admin.student_management.read_student permission.
 *     tags:
 *       - Subclasses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: subclassId, required: true, schema: { type: integer }, example: 12 }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
 *       - { in: query, name: search, schema: { type: string }, description: Partial match on first name, last name or registration number }
 *       - { in: query, name: status, schema: { type: string, enum: [active, inactive, suspended, graduated, withdrawn, blocked, pending] } }
 *     responses:
 *       200:
 *         description: Students fetched
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Subclass students fetched successfully
 *               data:
 *                 subclass: { id: 12, name: JSS 1A, class: { id: 10, name: JSS 1 } }
 *                 students:
 *                   - { id: 501, firstName: Ada, lastName: Obi, registrationNumber: KOL/2026/001, status: active, subclassId: 12 }
 *                 pagination: { page: 1, limit: 50, total: 1, totalPages: 1 }
 *       401:
 *         description: Unauthorized - Invalid or missing access token
 *       403:
 *         description: Missing permission
 *       404:
 *         description: Subclass not found in your business (SUBCLASS_NOT_FOUND)
 */
export const listSubclassStudentsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listSubclassStudents(
    subclassIdParam(req),
    getActor(req).businessId,
    req.query as unknown as ListSubclassStudentsQuery,
  );
  successResponse(res, "Subclass students fetched successfully", result);
};

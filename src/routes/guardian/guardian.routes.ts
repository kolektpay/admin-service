import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { getPermissionsQuerySchema, updatePermissionsSchema } from "../../validations/updatePermissions.schema";
import {
  getPermissionsHandler,
  updatePermissionsHandler,
} from "../../controllers/guardian/guardian.controller";


const router = Router();
// GET /permissions
// - No params: returns the logged-in user's own permissions (guardian OR student), derived from their token.
// - Guardian + ?registrationNumber=... OR ?studentEmail=... (not both): returns that student's permissions, if linked.
// - Student + any query param: rejected (400) — students never query on behalf of anyone.
router.get("/", authenticateJWT, validate(getPermissionsQuerySchema), getPermissionsHandler);

// POST /permissions
// Guardian-only. Adds/removes permissions for a linked student, identified by
// registrationNumber or studentEmail in the body (not both — enforced by validate()).
// NOTE: confirm checkStudentGuardianPermission reads the identifier from req.body
// (registrationNumber / studentEmail) rather than req.params — this route has no
// route param, so a middleware expecting req.params.registrationNumber will silently
// see undefined and may pass a check it shouldn't.
router.post(
  "/",
  authenticateJWT,

  validate(updatePermissionsSchema),
  updatePermissionsHandler,
);

export default router;

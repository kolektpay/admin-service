import { requirePermission } from "../../middleware/auth.middleware";

export const canReadClasses = requirePermission("admin.class_management.read_class");
export const canCreateClasses = requirePermission("admin.class_management.create_class");
export const canUpdateClasses = requirePermission("admin.class_management.update_class");
export const canDeleteClasses = requirePermission("admin.class_management.delete_class");
export const canAssignStudents = requirePermission("admin.class_management.assign_student");
export const canReadStudents = requirePermission("admin.student_management.read_student");

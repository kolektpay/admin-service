import prisma from "../config/database";

export class RolePermissionModel {
  /**
   * Get all permissions for a role with full permission details
   */
  static async getRolePermissions(roleIds: bigint[]) {
    const results = [];

    for (const roleId of roleIds) {
      const permissions = await prisma.roleHasPermission.findMany({
        where: {
          roleId: roleId,
        },
        include: {
          permission: true,
        },
      });

      results.push(permissions);
    }

 

    return results;
  }
}

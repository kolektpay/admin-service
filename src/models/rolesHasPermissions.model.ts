import prisma from "../config/database";

export class RoleHasPermissionsModel {
  /**
   * Get all permissions for a role with full permission details
   */
  static async getRoleAndPermissions() {
    const roles = await prisma.role.findMany({});

    let resultObject = {};

    let managerPermissionArray = [];

    let permissionArray = [];

    let managerFoundCount = 0;
    let finalReturn = [];

    const userPermissions = await prisma.permissions.findMany({});

    //     const user = { name: "Alice", age: 30, email: "alice@example.com" };

    // // "age" is extracted, and the rest are collected into "userWithoutAge"
    // const { age, ...userWithoutAge } = user;

    // console.log(userWithoutAge); // { name: "Alice", email: "alice@example.com"

    for (const oneentry of userPermissions) {
      const { createdAt, updatedAt, isBlacklisted, type, ...finalEntry } = oneentry;
      managerPermissionArray.push(finalEntry);
    }

    for (const eachrole of roles) {
      if (eachrole.name === "manager") {
        if (managerFoundCount === 0) {
          let role = {
            name: eachrole.name,
            id: eachrole.id,
          };

          let permission = managerPermissionArray;

          resultObject = { ...resultObject, role, permission };
          finalReturn.push(resultObject);
          managerFoundCount++;
        } else {
          resultObject;
        }
      } else {
        let role = {
          name: eachrole.name,
        };

        permissionArray.push(...managerPermissionArray.slice(0, 1));

        let permission = permissionArray;

        resultObject = { ...resultObject, role, permission };
        finalReturn.push(resultObject);
      }
    }
    return finalReturn;
  }
}

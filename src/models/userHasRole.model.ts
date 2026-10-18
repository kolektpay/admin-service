import prisma from "../config/database";
import ApiError from "../utils/apiError";

export class UserRoleModel {
  /**
   * Get user's role(s) with role details in a single query
   */
  static async getUserRoles(userId: string) {
    return await prisma.userHasRole.findMany({
      where: {
        userId: userId,
      },
      include: {
        role: true,
      },
    });
  }

  static async assignNewSuperUserRole(userId: string, businessId: bigint) {
    const managerRole = await prisma.role.findFirst({
      where: { name: "manager" },
    });

    if (!managerRole) {
      throw new ApiError(404, "Manager role not found");
    }

    // check if a manager already exists for this business as there can only be one manager per business
    const existingManager = await prisma.userHasRole.findFirst({
      where: {
        roleId: managerRole.id,
        businessId: businessId,
      },
    });

    if (existingManager) {
      throw new ApiError(400, "A manager already exists for this business");
    }

    return await prisma.userHasRole.create({
      data: {
        userId: userId,
        roleId: managerRole.id,
        businessId: businessId,
      },
    });
  }
static async getBusinessIdByUserId(
  userId: string | bigint,
  role: "user" | "guardian" | "student",
): Promise<bigint | null> {
  if (typeof userId === "string") {
    // for users
    try {
      const userRole = await prisma.userBusiness.findFirst({
        where: { userId },
        select: {
          businessId: true,
        },
      });

      if (!userRole) {
        throw new ApiError(404, "No business found for this user");
      }

      return userRole.businessId;
    } catch (error) {
      throw new ApiError(500, "Failed to get business id");
    }
  } else {


    if (role === "guardian") {
      // for guardians
      try {
        const guardianBusinessId = await prisma.guardians.findFirst({
          where: { id: BigInt(userId) },
          select: {
            businessId: true,
          },
        });

        if (!guardianBusinessId) {
          throw new ApiError(404, "No business found for this guardian");
        }

        return guardianBusinessId.businessId;
      } catch (error) {
        throw new ApiError(500, "Failed to get business id");
      }
    } else if (role === "student") {
      // for students
      try {
        const studentBusinessId = await prisma.students.findFirst({
          where: { id: BigInt(userId) },
          select: {
            businessId: true,
          },
        });

        if (!studentBusinessId) {
          throw new ApiError(404, "No business found for this student");
        }

        return studentBusinessId.businessId;
      } catch (error) {
        throw new ApiError(500, "Failed to get business id");
      }
    } else {
      throw new ApiError(400, "Invalid role");
    }
  }
}

}

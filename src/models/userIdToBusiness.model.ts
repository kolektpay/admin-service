import prisma from "../config/database";

export class UserToBusinessModel {
  static async mapUserToBusiness(userId: string, businessId: bigint) {
    return await prisma.userBusiness.create({
      data: {
        userId,
        businessId,
      },
    });
  }

  static async getAllUsersForOneBusiness(businessId: bigint) {
    return await prisma.userBusiness.findMany({
      where: { businessId: businessId },
    });
  }
}

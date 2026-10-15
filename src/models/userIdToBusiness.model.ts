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

}

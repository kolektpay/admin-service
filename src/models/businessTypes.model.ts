import prisma from "../config/database";
import ApiError from "../utils/apiError";

export class BusinessTypesModel {
  static async getAllBusinessTypes() {
    try {
      const businessTypes = await prisma.businessTypes.findMany({
        select: {
          id: true,
          name: true,
        },
      });

      return businessTypes.map((type) => ({
        ...type,
        id: Number(type.id),
      }));
    } catch (error) {
      throw new ApiError(500, "Failed to fetch business types");
    }
  }
}

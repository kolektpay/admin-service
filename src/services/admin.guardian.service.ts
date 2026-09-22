import prisma from "../config/database";
import ApiError from "../utils/apiError";
import { getCurrentTimestamp } from "../helpers/date.helper";
import bcrypt from "bcrypt";
import { TempPasswordTokenManager } from "../utils/tempPasswordTokenManager";
import { NotificationModel } from "../models/notifications.model";
import {
  IGuardianFormData,
  IGuardianResponse,
  IGuardianResponseForAuth,
} from "../interfaces/guardian.interfaces";

const saltRounds: number = Number(process.env.SALT_ROUNDS) || 13;
/**
 * Get all guardians with pagination
 */
export const getAllGuardiansAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist =
  async (
    page: number = 1,
    limit: number = 50,
    businessId: bigint,
    search?: string,
    status?: string,
  ): Promise<{
    guardians: IGuardianResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    try {

     
      const skip = (page - 1) * limit;

      /**
       * Base where clause
       * Only guardians belonging to this business
       * Only non-deleted guardians
       */
      const whereClause: any = {
        deletedAt: null,
        businessId,
      };

      /**
       * Optional status filter
       * Example: active / blocked
       */
      if (status) {
        whereClause.status = status;
      }

      /**
       * Optional search filter
       * Searches email OR firstName OR lastName
       */
      if (search) {
        whereClause.OR = [
          {
            firstName: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            lastName: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        ];
      }

      /**
       * Run both queries together
       */
      const [guardians, total] = await Promise.all([
        prisma.guardians.findMany({
          skip,
          take: limit,
          where: whereClause,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            status: true,
            address: true,
          },
        }),

        prisma.guardians.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        guardians: guardians,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      throw new ApiError(500, "Failed to fetch guardians");
    }
  };
/**


/**
 * Create a new guardian or guardians (by manager or anyone with the permission)
 */
export const createNewGuardianEntry = async (
  guardianDataArray: IGuardianFormData[],
  businessId: bigint,
): Promise<IGuardianResponseForAuth[]> => {
  let createdGuardianArray: IGuardianResponseForAuth[] = [];

  try {
    for (const eachGuardian of guardianDataArray) {
         

      const temp_password = await TempPasswordTokenManager.generateToken();

      const hashedPassword = await bcrypt.hash(temp_password, saltRounds);
      const mustChangePasswordValue = true;

      const createdGuardian = await prisma.guardians.create({
        data: {
          firstName: eachGuardian.firstName,
          lastName: eachGuardian.lastName,

          address: eachGuardian.address,

          email: eachGuardian.email as string,
          phoneNumber: eachGuardian.phoneNumber as string,

          businessId: businessId,
          password: hashedPassword,
          mustChangePassword: mustChangePasswordValue,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,

          status: true,

          email: true,
          phoneNumber: true,

          address: true,

          mustChangePassword: true,
          password: true,
          failedLoginCount: true,
        },
      });

      const guardianDataForChangingPassword = {
        email: eachGuardian.email as string,
        firstName: eachGuardian.firstName,
        lastName: eachGuardian.lastName,
        generatedPassword: temp_password,
        resetLink: `${process.env.MUST_CHANGE_PASSWORD_LINK_URL}/change-password?email=${eachGuardian.email}`,
      };
      await NotificationModel.sendTempPasswordNotificationForGuardians(
        guardianDataForChangingPassword,
      );
      createdGuardianArray.push(createdGuardian);
    }

    return createdGuardianArray;
  } catch (error) {
    throw new ApiError(500, "Failed to create guardian(s)");
  }
};

/**
 * Update student info
 */
export const updateGuardianInfo = async (
  businessId: bigint,
  guardianId: string,
  guardianInfoToUpdate: object,
): Promise<IGuardianResponse> => {
  try {
    const returnedGuardianInfo = await prisma.guardians.update({
      where: { businessId, id: BigInt(guardianId) },
      data: guardianInfoToUpdate,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        email: true,
        phoneNumber: true,
        address: true,
      },
    });

    return returnedGuardianInfo;
  } catch (error) {
    throw new ApiError(500, "Failed to update guardian info");
  }
};

// delete guardian info

export const deleteGuardianInfo = async (
  businessId: bigint,
  guardianId: string,
): Promise<void> => {
  try {
    const deletedAt = getCurrentTimestamp();
    await prisma.guardians.update({
      where: { businessId, id: BigInt(guardianId) },
      data: { deletedAt },
    });
  } catch (error) {
    throw new ApiError(500, "Failed to delete guardian");
  }
};

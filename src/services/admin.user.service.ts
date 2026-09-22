import prisma from "../config/database";
import { addDays, getCurrentTimestamp } from "../helpers/date.helper";
import { IServiceResponse } from "../interfaces/common.interface";
import {
  ICreateUserDTO,
  IUpdateUserDTO,
  IUserResponse,
  ISafeUserResponse,
} from "../interfaces/user.interface";
import bcrypt from "bcrypt";
import ApiError from "../utils/apiError";
import { AuditModel } from "../models/audit.model";
import { UserStatus } from "@prisma/client";
import { UserModel } from "../models/user.model";
import { PasswordHistoryModel } from "../models/passwordHistory.model";

const saltRounds: number = Number(process.env.SALT_ROUNDS) || 13;

/**
 * Get all users with pagination
 */
export const getAllUsersAndCheckIfSearchAndStatusCriteriaexist = async (
  page: number = 1,
  limit: number = 10,
  businessId: bigint,
  search?: string,
  status?: string,
): Promise<{
  users: ISafeUserResponse[];
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
     * Only users belonging to this business
     * Only non-deleted users
     */
    const whereClause: any = {
      deletedAt: null,
      userHasRoles: {
        some: {
          businessId,
        },
      },
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
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
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
      ];
    }

    /**
     * Run both queries together
     */
    const [users, total] = await Promise.all([
      prisma.users.findMany({
        skip,
        take: limit,
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          failedLoginCount: true,
          passwordExpiresAt: true,
          totpEnabled: true,

          userHasRoles: {
            where: { businessId },
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),

      prisma.users.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    throw new ApiError(500, "Failed to fetch users");
  }
};
/**
 * Get user by ID
 */
export const getUserByUniqueId = async (
  id: string,
): Promise<IUserResponse | null> => {
  try {
    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        status: true,
        updatedAt: true,
        password: true,
        passwordExpiresAt: true,
        failedLoginCount: true,
        totpEnabled: true,
      },
    });
    return user;
  } catch (error) {
    throw new ApiError(500, "Failed to fetch user");
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (
  email: string,
): Promise<IUserResponse | null> => {
  try {
    const user: IUserResponse | null = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        password: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        onBoardTracker: true,
        passwordExpiresAt: true,
        failedLoginCount: true,
        totpEnabled: true,
      },
    });
    return user;
  } catch (error) {
    throw new ApiError(500, "Failed to fetch user by email");
  }
};

/**
 * Create manager user and send OTP
 */
export const createUserBeforeOtpVerify = async (
  data: ICreateUserDTO,
): Promise<IServiceResponse> => {
  let response: IServiceResponse;
  const now = getCurrentTimestamp();
  const expiresAt = addDays(now, 90);
  const mustChangePasswordValue = false;
  const userIpAddress = data.ipAddress;

  try {
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);
    delete data.ipAddress;
    const user = {
      ...data,
      firstName: data.firstName.toLowerCase(),
      lastName: data.lastName.toLowerCase(),
      password: hashedPassword,
      passwordExpiresAt: expiresAt,
      passwordCreatedAt: now,
      mustChangePassword: mustChangePasswordValue,
      status: "otp_verify" as UserStatus,
    };

    const createdUser = await prisma.users.create({
      data: user,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        status: true,
        passwordExpiresAt: true,
        mustChangePassword: false,
        passwordCreatedAt: true,
        failedLoginCount: true,
        phoneNumber: true,
        totpEnabled: true,
        onBoardTracker: true,
      },
    });

    if (!createdUser) {
      response = {
        success: false,
        code: 400,
        message: "failed to create user.",
      };
      return response;
    }

    // manager is self-created
    await prisma.users.update({
      where: { id: createdUser.id },
      data: { createdBy: createdUser.id },
    });

    response = {
      success: true,
      code: 200,
      message: "User created on db. Next step is to then verify otp.",
    };
    await PasswordHistoryModel.createPasswordHistory(
      createdUser.id,
      hashedPassword,
    );
    await AuditModel.logNewManagerUserCreated(createdUser.id, userIpAddress);
    return response;
  } catch (error) {
    console.log(error);
    response = {
      success: false,
      code: 500,
      message: "Internal server error.",
    };
    return response;
  }
};

/**
 * Create a new user (by manager)
 */
export const createUser = async (
  data: ICreateUserDTO,
  managerUserId: string,
): Promise<IUserResponse> => {
  try {
    const now = getCurrentTimestamp();
    const expiresAt = addDays(now, 90);
    const mustChangePasswordValue = true;

    const user = {
      ...data,
      firstName: data.firstName.toLowerCase(),
      lastName: data.lastName.toLowerCase(),
      passwordExpiresAt: expiresAt,
      passwordCreatedAt: now,
      mustChangePassword: mustChangePasswordValue,
      createdBy: managerUserId,
    };

    const createdUser = await prisma.users.create({
      data: user,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        password: true,
        status: true,
        passwordExpiresAt: true,
        mustChangePassword: false,
        passwordCreatedAt: true,
        failedLoginCount: true,
        phoneNumber: true,
        totpEnabled: true,
      },
    });

    return createdUser;
  } catch (error) {
    throw new ApiError(500, "Failed to create user");
  }
};

/**
 * Update user
 */
export const updateUser = async (
  id: string,
  data: IUpdateUserDTO,
): Promise<IUserResponse | null> => {
  const { ...updateData } = data;

  let finalData;
  if (updateData.firstName && updateData.lastName) {
    finalData = {
      ...updateData,
      firstName: updateData.firstName.toLowerCase(),
      lastName: updateData.lastName.toLowerCase(),
    };
  }

  try {
    // if-else is here to make sure that the first name and last name are always changed to lower case if thery were included in the data that is to be sent to the db
    if (finalData) {
      const user = await prisma.users.update({
        where: { id },
        data: finalData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          password: true,
          createdAt: true,
          updatedAt: true,
          failedLoginCount: true,
          totpEnabled: true,
        },
      });
      return user;
    } else {
      const user = await prisma.users.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          password: true,
          createdAt: true,
          updatedAt: true,
          failedLoginCount: true,
          totpEnabled: true,
        },
      });
      return user;
    }
  } catch (error) {
    throw new ApiError(500, "Failed to update user");
  }
};

/**
 * Delete user
 */
export const deleteUser = async (id: string): Promise<void> => {
  try {
    await UserModel.deleteUserAccount(id);
  } catch (error) {
    throw new ApiError(500, "Failed to delete user");
  }
};

/**
 * Block user and revoke tokens
 */
export const blockUser = async (id: string, reason: string): Promise<void> => {
  try {
    await UserModel.blockAccount(id, reason);

    await prisma.userTokens.updateMany({
      where: { userId: id },
      data: {
        revoked: true,
      },
    });
  } catch (error) {
    throw new ApiError(500, "Failed to block user");
  }
};

/**
 * Unblock user
 */
export const unblockUser = async (id: string): Promise<void> => {
  try {
    await UserModel.unblockAccount(id);
    await UserModel.resetFailedLoginCount(id);
  } catch (error) {
    throw new ApiError(500, "Failed to unblock user");
  }
};

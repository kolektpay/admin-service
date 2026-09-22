import prisma from "../config/database";
import {
  IStudentFormData,
  IStudentResponse,
  IStudentResponseForAuth,
} from "../interfaces/student.interfaces";
import ApiError from "../utils/apiError";
import { getCurrentTimestamp } from "../helpers/date.helper";
import bcrypt from "bcrypt";
import { TempPasswordTokenManager } from "../utils/tempPasswordTokenManager";
import { NotificationModel } from "../models/notifications.model";

const saltRounds: number = Number(process.env.SALT_ROUNDS) || 13;
/**
 * Get all users with pagination
 */
export const getAllStudentsAccordingToBusinessIdAndCheckIfSearchAndStatusCriteriaexist =
  async (
    page: number = 1,
    limit: number = 50,
    businessId: bigint,
    search?: string,
    status?: string,
  ): Promise<{
    students: IStudentResponse[];
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
       * Searches registrationNumber OR firstName OR lastName
       */
      if (search) {
        whereClause.OR = [
          {
            registrationNumber: {
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
          {
            class: {
              contains: search,
              mode: "insensitive",
            },
          },
        ];
      }

      /**
       * Run both queries together
       */
      const [students, total] = await Promise.all([
        prisma.students.findMany({
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
            middleName: true,
            subclassId: true,
            subclass: {
              select: {
                name: true,
              },
            },
            email: true,
            phoneNumber: true,
            status: true,
            age: true,
            gender: true,
            dateOfBirth: true,
            registrationNumber: true,
            address: true,
          },
        }),

        prisma.students.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        students,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      throw new ApiError(500, "Failed to fetch students");
    }
  };
/**


/**
 * Create a new student or students (by manager)
 */
export const createNewStudentEntry = async (
  studentDataArray: IStudentFormData[],
  businessId: bigint,
): Promise<IStudentResponseForAuth[]> => {
  let createdStudentArray: IStudentResponseForAuth[] = [];
  try {
    for (const eachStudent of studentDataArray) {
      const temp_password = await TempPasswordTokenManager.generateToken();

      const hashedPassword = await bcrypt.hash(temp_password, saltRounds);
      const mustChangePasswordValue = true;

      const createdStudent = await prisma.students.create({
        data: {
          subclassId: eachStudent.subclassId,
          age: eachStudent.age,
          gender: eachStudent.gender,
          dateOfBirth: new Date(eachStudent.dateOfBirth),
          firstName: eachStudent.firstName,
          lastName: eachStudent.lastName,
          middleName: eachStudent.middleName,
          registrationNumber: eachStudent.registrationNumber,
          address: eachStudent.address,
          avatar: eachStudent.avatar,
          email: eachStudent.email as string,
          phoneNumber: eachStudent.phoneNumber as string,

          businessId: businessId,
          password: hashedPassword,
          mustChangePassword: mustChangePasswordValue,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          subclass: {
            select: {
              id: true,
              name: true,
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          subclassId: true,
          status: true,
          age: true,
          email: true,
          phoneNumber: true,
          gender: true,
          dateOfBirth: true,
          registrationNumber: true,
          address: true,
          avatar: true,
          mustChangePassword: true,
          password: true,
          failedLoginCount: true,
          businessId: true, // ← add
          createdAt: true, // ← add
          updatedAt: true, // ← add
          lastLoggedInAt: true,
          passwordExpiresAt: true,
        },
      });

      const userDataForChangingPassword = {
        email: eachStudent.email as string,
        firstName: eachStudent.firstName,
        lastName: eachStudent.lastName,
        generatedPassword: temp_password,
        resetLink: `${process.env.MUST_CHANGE_PASSWORD_LINK_URL}/change-password?email=${eachStudent.email}`,
      };
      await NotificationModel.sendTempPasswordNotificationForStudents(
        userDataForChangingPassword,
      );
      createdStudentArray.push(createdStudent);
    }

    return createdStudentArray;
  } catch (error) {
    throw new ApiError(500, "Failed to create student(s)");
  }
};

/**
 * Update student info
 */
export const updateStudentInfo = async (
  businessId: bigint,
  registrationNumber: string,
  studentInfoToUpdate: object,
): Promise<IStudentResponse> => {
  try {
    const returnedStudentInfo = await prisma.students.update({
      where: { businessId, registrationNumber },
      data: studentInfoToUpdate,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        subclassId: true,
        middleName: true,
        subclass: {
          select: {
            name: true,
          },
        },
        status: true,
        age: true,
        gender: true,
        email: true,
        phoneNumber: true,
        dateOfBirth: true,
        registrationNumber: true,
        address: true,
      },
    });

    return returnedStudentInfo;
  } catch (error) {
    throw new ApiError(500, "Failed to update user");
  }
};

// delete student

export const deleteStudentInfo = async (
  businessId: bigint,
  registrationNumber: string,
): Promise<void> => {
  try {
    const deletedAt = getCurrentTimestamp();
    await prisma.students.update({
      where: { businessId, registrationNumber },
      data: { deletedAt },
    });
  } catch (error) {
    throw new ApiError(500, "Failed to delete user");
  }
};

import { onBoardTrackerType } from "@prisma/client";
import prisma from "../config/database";
import { ICreateBusinessDTO } from "../interfaces/business.interface";
import { IServiceResponse } from "../interfaces/common.interface";
import { getUserByEmail } from "./user.service";
import { UserRoleModel } from "../models/userHasRole.model";
import { createWallet } from "../thirdPartyService/wallet.services";
import { AuditModel } from "../models/audit.model";
import { UserToBusinessModel } from "../models/userIdToBusiness.model";

export const createUserBusiness = async (
  data: ICreateBusinessDTO,
): Promise<IServiceResponse> => {
  let response: IServiceResponse;
  let createdUserBusiness;

  try {
    const getUserIdFromUserEmail = await getUserByEmail(data.userEmail);

    const userIpAddress = data.ipAddress;
    if (getUserIdFromUserEmail) {
      try {
        await prisma.users.update({
          where: {
            id: getUserIdFromUserEmail.id,
          },
          data: {
            onBoardTracker: data.stepper as onBoardTrackerType,
          },
        });
      } catch (error) {
        console.log(error);
      }

      delete data.stepper;
      delete data.ipAddress;

      createdUserBusiness = await prisma.businesses.create({
        data,
        select: {
          id: true,
          name: true,
          rcNumber: true,
          businessTypeId: true,
          status: true,
          phoneNumber: true,
          address: true,
          userEmail: true,
          businessEmail: true,
          description: true,
        },
      });
    }

    if (!createdUserBusiness) {
      response = {
        success: false,
        code: 400,
        message: "failed to create user business.",
      };

      return response;
    }

    response = {
      success: true,
      code: 200,
      message: "User business created successfully.",
    };

    if (!getUserIdFromUserEmail) {
      response = {
        success: false,
        code: 404,
        message: "user with this email does not exist.",
      };

      return response;
    }

    await UserRoleModel.assignNewSuperUserRole(
      getUserIdFromUserEmail.id,
      createdUserBusiness.id,
    );

    await UserToBusinessModel.mapUserToBusiness(
      getUserIdFromUserEmail.id,
      createdUserBusiness.id,
    );

    await prisma.users.update({
      where: {
        id: getUserIdFromUserEmail.id,
      },
      data: {
        status: "active",
      },
    });

    try {
      await createWallet(
        getUserIdFromUserEmail.id,
        Number(createdUserBusiness.id),
      );

      response = {
        success: true,
        code: 200,
        message: "onboarding registration complete",
      };
      await AuditModel.logManagerBusinessCreated(
        getUserIdFromUserEmail.id,
        userIpAddress,
      );
      return response;
    } catch (error) {
      console.log(error);
      response = {
        success: false,
        code: 400,
        message: "Incomplete onboarding registration",
      };
      return response;
    }
  } catch (error) {
    console.log(error);

    return (response = {
      success: false,
      code: 500,
      message: "Internal server error.",
    });
  }
};

import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/response.util";
import TokenManager from "../utils/token.manager";
import ApiError from "../utils/apiError";
import prisma from "../config/database";

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  try {
    if (!authHeader) {
      return errorResponse(res, "unauthorised", 401);
    }

    const token = authHeader.split(" ")[1]; // Bearer <jwt>
    let isTokenValid = null;
    try {
      isTokenValid = await TokenManager.verifyAccessToken(token);
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(res, error.message, error.statusCode);
      }
    }

    if (!isTokenValid) {
      return errorResponse(res, "Invalid login credentials", 401);
    }

    if (isTokenValid.tokenData.revoked) {
      return errorResponse(res, "token invalid or revoked", 401);
    }

    if (isTokenValid.decoded.role === "guardian") {
      req.userId = isTokenValid.decoded.guardianId;
      req.businessId = isTokenValid.decoded.businessId;
      req.role = isTokenValid.decoded.role;
   
      next();
    } else if (isTokenValid.decoded.role === "student") {
      req.userId = isTokenValid.decoded.studentId;
      req.businessId = isTokenValid.decoded.businessId;
      req.role = isTokenValid.decoded.role;
 
      next();
    } else {
      req.userId = isTokenValid.decoded.userId;
      req.businessId = isTokenValid.decoded.businessId;
      req.role = isTokenValid.decoded.role;
  
      next();
    }
  } catch (error) {
    console.log(error);
  }
};

export const requireManager = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId;

  try {
    if (!userId) {
      return errorResponse(res, "unauthorised", 401);
    }

    let userRole = null;

    try {
      userRole = await prisma.userHasRole.findFirst({
        where: {
          userId: userId as string,
        },
        include: {
          role: true,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(res, error.message, error.statusCode);
      }
    }

    if (!userRole) {
      return errorResponse(res, "unauthorised", 401);
    }

    if (userRole.role?.name !== "manager") {
      return errorResponse(res, "unauthorised. managers only", 403);
    }

    next();
  } catch (error) {
    console.log(error);
  }
};

export const requireKolektSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId;

  try {
    if (!userId) {
      return errorResponse(res, "unauthorised", 401);
    }

    let userRole = null;

    try {
      userRole = await prisma.userHasRole.findFirst({
        where: {
          userId: userId as string,
        },
        include: {
          role: true,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(res, error.message, error.statusCode);
      }
    }

    if (!userRole) {
      return errorResponse(res, "unauthorised", 401);
    }

    if (userRole.role?.name !== "Kolekt-super-admin") {
      return errorResponse(res, "unauthorised kolekt super admin only", 403);
    }

    next();
  } catch (error) {
    console.log(error);
  }
};

export const checkIfStaffHasStudentGuardianPermission = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId;

  try {
    if (!userId) {
      return errorResponse(res, "unauthorised", 401);
    }

    let userRole = null;

    try {
      userRole = await prisma.userHasRole.findFirst({
        where: {
          userId: userId as string,
        },
        include: {
          role: true,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(res, error.message, error.statusCode);
      }
    }

    if (!userRole) {
      return errorResponse(res, "unauthorised", 401);
    }

    const hasPermission = await prisma.roleHasPermission.findFirst({
      where: {
        roleId: userRole.roleId as bigint,
        permission: {
          name: {
            startsWith: "admin.student_management.",
          },
        },
      },
    });

    const hasGuardianPermission = await prisma.roleHasPermission.findFirst({
      where: {
        roleId: userRole.roleId as bigint,
        permission: {
          name: {
            startsWith: "admin.guardian_management.",
          },
        },
      },
    });

    if (!hasPermission || !hasGuardianPermission) {
      return errorResponse(
        res,
        "unauthorised: missing student/guardian permission",
        403,
      );
    }

    next();
  } catch (error) {
    console.log(error);
  }
};

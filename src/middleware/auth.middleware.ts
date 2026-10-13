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
      // Not an auth failure (e.g. database unreachable): let the error handler return a 500
      return next(error);
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
    next(error);
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


export const checkIfStaffHasPaymentItemApprovalPermission = async (
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

    const hasApprovalPermission = await prisma.roleHasPermission.findFirst({
      where: {
        roleId: userRole.roleId as bigint,
        permission: {
          name: "admin.payment_item.approve",
        },
      },
    });

    if (!hasApprovalPermission) {
      return errorResponse(
        res,
        "unauthorised: missing payment item approval permission",
        403,
      );
    }

    next();
  } catch (error) {
    console.log(error);
  }
};

/**
 * Allows the request through only if the authenticated staff user's role
 * has the given permission. Student and guardian tokens are always rejected.
 */
export const requirePermission =
  (permissionName: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return errorResponse(res, "unauthorised", 401);
      }

      if (req.role === "student" || req.role === "guardian" || !req.businessId) {
        return errorResponse(res, "unauthorised: staff only", 403);
      }

      const hasPermission = await prisma.roleHasPermission.findFirst({
        where: {
          permission: { name: permissionName },
          role: { userHasRoles: { some: { userId: req.userId as string } } },
        },
        select: { roleId: true },
      });

      if (!hasPermission) {
        return errorResponse(
          res,
          `unauthorised: missing ${permissionName} permission`,
          403,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

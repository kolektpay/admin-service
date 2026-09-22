import { onBoardTrackerType } from "@prisma/client";

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateUserDTO {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phoneNumber: string;
  onBoardTracker?: onBoardTrackerType;
  passwordExpiresAt?: Date;
  mustChangePassword?: Boolean;
  passwordCreatedAt?: Date;
  createdBy?: string;
  ipAddress?: string;
}

export interface IUpdateUserDTO {
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface IUserResponse {
  id: string;
  email: string;
  status: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  password: string;
  passwordExpiresAt?: Date | null;
  mustChangePassword?: Boolean | null;
  failedLoginCount: number;
  totpEnabled: boolean;
  onBoardTracker?: string;
  totpTempExpiresAt?: Date | null;
  totpTempSecret?: string | null;
  totpSecret?: string | null;
  totpStatus?: Boolean | null;
  totpRequired?: Boolean | null;
}

export interface ISafeUserResponse {
  id: string;
  email: string;
  status: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
  passwordExpiresAt?: Date | null;
  mustChangePassword?: Boolean | null;
  failedLoginCount: number;
  totpEnabled: boolean;
  onBoardTracker?: string;
  totpTempExpiresAt?: Date | null;
  totpTempSecret?: string | null;
  totpSecret?: string | null;
  totpStatus?: Boolean | null;
  totpRequired?: Boolean | null;
}

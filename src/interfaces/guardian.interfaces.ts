export interface IGuardianFormData {
  firstName: string;
  lastName: string;

  email?: string;
  phoneNumber?: string;

  address: string;
}

export interface IGuardianResponseForAuth {
  id: bigint;
  firstName?: string | null;
  lastName?: string | null;
address?: string | null;
  email?: string | null;
  status?: string | null;
  password?: string | null;
  passwordExpiresAt?: Date | null;
  createdAt?: Date | null;
  failedLoginCount: number;
  lastLoggedInAt?: Date | null;
  phoneNumber?: string | null;
  mustChangePassword: boolean | null;
}



export interface IGuardianResponse {
  id: bigint;

  firstName: string;
  lastName: string;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;

}

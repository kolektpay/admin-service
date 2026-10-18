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


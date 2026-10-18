export interface EmailUser {
  email: string;
  firstName: string;
  lastName: string;
}

export interface LoginNotificationData {
  email: string;
  firstName: string;
  lastName: string;
  ipAddress?: string;
  device?: string;
  location?: string;
  browser?: string;
  os?: string;
}

export interface PasswordResetNotificationData {
  email: string;
  fullName: string;
  resetLink: string;
}

export interface MustChangePasswordNotificationData {
  email: string;
  firstName: string;
  lastName: string;
  generatedPassword: string;
  resetLink: string;
}

export interface IStudentFormData {
  subclassId: number;
  age: number;
  gender: string;

  dateOfBirth: Date;

  firstName: string;
  lastName: string;
  middleName?: string;
  avatar: string | null;

  registrationNumber?: string | null;

  address: string;
  email?: string;
  phoneNumber?: string;
  parentPhoneNumber: string;
  parentEmail?: string;
  parentName: string;
}

export interface IStudentResponse {
  id: bigint;

  subclassId: bigint;
  firstName: string;
  lastName: string;

  middleName?: string | null;
  subclass: object;

  age: number;
  gender: string;
  dateOfBirth: Date;
  email?: string | null;
  phoneNumber?: string | null;

  registrationNumber?: string | null;
  address: string;
}

export interface IStudentResponseForAuth {
  id: bigint;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  subclass: {
    id: bigint;
    name: string;
    class: {
      id: bigint;
      name: string;
    };
  };
  subclassId: bigint;
  avatar: string | null;
  age: number;
  status: string;
  gender: string;
  dateOfBirth: Date;
  email: string;
  businessId: bigint;
  password: string;
  passwordExpiresAt?: Date | null;
  failedLoginCount: number;
  phoneNumber: string;
  lastLoggedInAt?: Date | null;
  registrationNumber?: string | null;
  address: string;
  mustChangePassword: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

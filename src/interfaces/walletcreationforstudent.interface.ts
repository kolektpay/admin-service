export interface CreateStudentWalletInterface {
  businessId: bigint;
  student: {
    firstName: string;
    lastName: string;
    middleName?: string;
    emailAddress: string;
    mobileNumber: string;
    address: string;
    city: string;
    alias: string;
    studentId: number;
  };
}
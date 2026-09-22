

export interface ICreateBusinessDTO {
  name: string;
  rcNumber: string;
  businessTypeId: bigint;
  phoneNumber: string;
  address: string;
  userEmail: string;
  businessEmail: string;
  description: string;
  stepper?: string;
  ipAddress?: string;
}



export interface BankDataForOneBusiness {
  businessId: number;
  pageInteger: number;
  limitInteger: number;
}

export interface BankDataToaddNewBankToBusiness {
  walletId: number;
  businessId: number;
  bankName: string;
  accountName: string;
  accountNumber: number;
}

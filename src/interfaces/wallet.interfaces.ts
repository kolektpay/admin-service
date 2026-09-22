export interface GeneratePaymentLinkRequestBody {
  amount: number;
  currency: string;
  description: string;
  expiresInMinutes: number;
  businessId: number;
  customerName: string;
  customerEmail:string;
  customerPhone: string;
}

export interface GetAllPaymentLinksParamsBody {
  businessId: number;
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
}

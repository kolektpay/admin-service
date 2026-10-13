// Endpoints on the payment service, relative to PAYMENT_SERVICE_BASE_URL
// (e.g. https://payment-service.kolekt.cloud/api/v1).
export class PaymentServiceEndpoints {
  static readonly CREATE_WALLET = "/wallet/create";
  static readonly CREATE_STUDENT_WALLET = "/wallet/student-wallet";
  static readonly GET_WALLET_DETAILS = "/wallet";
  static readonly GENERATE_PAYMENT_LINK = "/payment-links";
  static readonly GET_ALL_BANKS_USED_BY_ONE_BUSINESS = "/banks";
  static readonly GET_ALL_TRANSACTIONS = "/wallets";
  static readonly GET_A_SPECIFIC_TRANSACTION = "/transactions";
  static readonly CREATE_A_PAYMENT_ITEM_WALLET = "/wallet/payment-wallet";
}

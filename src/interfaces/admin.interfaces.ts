/** The staff member performing an admin or role management action. */
export interface AdminActor {
  userId: string;
  businessId: bigint;
  ip?: string;
}

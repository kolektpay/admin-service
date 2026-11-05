import { requirePermission } from "../../middleware/auth.middleware";

// Reuses the existing seeded permissions in seeders/data/globalPermission.ts
export const canViewLedger = requirePermission("admin.transaction_details.view");
export const canExportLedger = requirePermission("admin.transaction_details.export");
export const canViewTransactions = requirePermission("admin.recent_transactions.view");
export const canViewTransactionDetails = requirePermission("admin.transaction_details.view");
export const canSimulateInflow = requirePermission("admin.initiate_payment.create");
export const canManageWallets = requirePermission("admin.menu.wallets");

import { Request } from 'express'; // Keep this import to ensure the file is treated as a module

declare global {
  namespace Express {
    interface Request {
      /** The authenticated user's ID, populated by auth middleware */
      userId?: string | bigint;
       /** The authenticated user business ID*/
      businessId?: number | bigint;
      /** Custom session data object */
      stude
      role?: string;
      sessionData?: {
        createdAt: Date;
        // ... other session properties
      };
    }
  }
}

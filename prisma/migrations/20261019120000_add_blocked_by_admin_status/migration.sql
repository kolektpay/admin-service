-- AlterEnum
-- Set only by an administrator; unlike "blocked" (failed logins, expired
-- password) it cannot be cleared by a password reset
ALTER TYPE "UserStatus" ADD VALUE 'blocked_by_admin';

-- AlterTable
ALTER TABLE "guardians" ADD COLUMN     "block_reason" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_logged_in_at" TIMESTAMP(3),
ADD COLUMN     "password_created_at" TIMESTAMP(3),
ADD COLUMN     "password_expires_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3);

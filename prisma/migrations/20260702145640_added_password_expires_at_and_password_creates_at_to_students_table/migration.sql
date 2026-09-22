-- AlterTable
ALTER TABLE "students" ADD COLUMN     "password_created_at" TIMESTAMP(3),
ADD COLUMN     "password_expires_at" TIMESTAMP(3);

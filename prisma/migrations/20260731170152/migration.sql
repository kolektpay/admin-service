-- CreateEnum
CREATE TYPE "GuardianStatus" AS ENUM ('active', 'inactive', 'deceased', 'removed');

-- AlterTable
ALTER TABLE "guardians" ADD COLUMN     "status" "GuardianStatus" NOT NULL DEFAULT 'active';

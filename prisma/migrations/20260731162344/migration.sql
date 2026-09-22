/*
  Warnings:

  - You are about to drop the column `parents_guardians_name` on the `guardians` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "guardians" DROP COLUMN "parents_guardians_name",
ADD COLUMN     "parents_guardians_first_name" TEXT,
ADD COLUMN     "parents_guardians_last_name" TEXT;

/*
  Warnings:

  - A unique constraint covering the columns `[parents_or_guardians_phone_number]` on the table `guardians` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[parents_or_guardians_email]` on the table `guardians` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "guardians_parents_or_guardians_phone_number_parents_or_guar_key";

-- AlterTable
ALTER TABLE "guardians" ADD COLUMN     "password" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "guardians_parents_or_guardians_phone_number_key" ON "guardians"("parents_or_guardians_phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_parents_or_guardians_email_key" ON "guardians"("parents_or_guardians_email");

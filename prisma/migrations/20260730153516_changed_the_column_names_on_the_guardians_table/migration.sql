/*
  Warnings:

  - You are about to drop the column `parents_guardians_email` on the `guardians` table. All the data in the column will be lost.
  - You are about to drop the column `parents_guardians_phone_number` on the `guardians` table. All the data in the column will be lost.
  - Added the required column `parents_or_guardians_phone_number` to the `guardians` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "guardians" DROP COLUMN "parents_guardians_email",
DROP COLUMN "parents_guardians_phone_number",
ADD COLUMN     "parents_or_guardians_email" TEXT,
ADD COLUMN     "parents_or_guardians_phone_number" VARCHAR(15) NOT NULL;

/*
  Warnings:

  - Made the column `password` on table `guardians` required. This step will fail if there are existing NULL values in that column.
  - Made the column `parents_guardians_first_name` on table `guardians` required. This step will fail if there are existing NULL values in that column.
  - Made the column `parents_guardians_last_name` on table `guardians` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "guardians" ALTER COLUMN "password" SET NOT NULL,
ALTER COLUMN "parents_guardians_first_name" SET NOT NULL,
ALTER COLUMN "parents_guardians_last_name" SET NOT NULL;

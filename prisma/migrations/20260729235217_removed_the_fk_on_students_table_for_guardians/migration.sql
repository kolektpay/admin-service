/*
  Warnings:

  - You are about to drop the column `guardian_id` on the `students` table. All the data in the column will be lost.
  - You are about to drop the `Guardians` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT "students_guardian_id_fkey";

-- AlterTable
ALTER TABLE "students" DROP COLUMN "guardian_id";

-- DropTable
DROP TABLE "Guardians";

-- CreateTable
CREATE TABLE "guardians" (
    "id" BIGSERIAL NOT NULL,
    "parents_guardians_phone_number" VARCHAR(15) NOT NULL,
    "parents_guardians_email" TEXT,
    "parents_guardians_name" TEXT NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

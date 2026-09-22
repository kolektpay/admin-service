/*
  Warnings:

  - You are about to drop the column `parents_guardians_email` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `parents_guardians_name` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `parents_guardians_phone_number` on the `students` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "students" DROP COLUMN "parents_guardians_email",
DROP COLUMN "parents_guardians_name",
DROP COLUMN "parents_guardians_phone_number",
ADD COLUMN     "guardian_id" BIGINT;

-- CreateTable
CREATE TABLE "Guardians" (
    "id" BIGSERIAL NOT NULL,
    "parents_guardians_phone_number" VARCHAR(15) NOT NULL,
    "parents_guardians_email" TEXT,
    "parents_guardians_name" TEXT NOT NULL,

    CONSTRAINT "Guardians_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "Guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

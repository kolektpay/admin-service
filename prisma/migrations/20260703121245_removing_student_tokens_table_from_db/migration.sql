/*
  Warnings:

  - You are about to drop the `student_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "student_tokens" DROP CONSTRAINT "student_tokens_student_id_fkey";

-- DropTable
DROP TABLE "student_tokens";

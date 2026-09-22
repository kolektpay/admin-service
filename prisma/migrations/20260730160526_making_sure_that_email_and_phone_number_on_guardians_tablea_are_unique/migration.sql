/*
  Warnings:

  - A unique constraint covering the columns `[parents_or_guardians_phone_number,parents_or_guardians_email]` on the table `guardians` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "guardians_parents_or_guardians_phone_number_parents_or_guar_key" ON "guardians"("parents_or_guardians_phone_number", "parents_or_guardians_email");

/*
  Warnings:

  - You are about to drop the `Subclasses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Subclasses" DROP CONSTRAINT "Subclasses_classId_fkey";

-- DropForeignKey
ALTER TABLE "Subclasses" DROP CONSTRAINT "Subclasses_paymentItemId_fkey";

-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT "students_subclass_id_fkey";

-- DropTable
DROP TABLE "Subclasses";

-- CreateTable
CREATE TABLE "subclasses" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "classId" BIGINT NOT NULL,
    "paymentItemId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subclasses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subclasses_classId_name_key" ON "subclasses"("classId", "name");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_subclass_id_fkey" FOREIGN KEY ("subclass_id") REFERENCES "subclasses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_paymentItemId_fkey" FOREIGN KEY ("paymentItemId") REFERENCES "payment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

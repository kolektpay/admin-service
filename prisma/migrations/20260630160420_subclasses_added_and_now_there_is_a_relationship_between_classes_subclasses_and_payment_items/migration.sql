/*
  Warnings:

  - You are about to drop the column `class_id` on the `payment_items` table. All the data in the column will be lost.
  - You are about to drop the column `payment_description` on the `payment_items` table. All the data in the column will be lost.
  - You are about to drop the column `class_id` on the `students` table. All the data in the column will be lost.
  - You are about to drop the `class` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `Description` to the `payment_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_name` to the `payment_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_number` to the `payment_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `assigned_subclass` to the `payment_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subclass_id` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "payment_items" DROP CONSTRAINT "payment_items_class_id_fkey";

-- DropForeignKey
ALTER TABLE "students" DROP CONSTRAINT "students_class_id_fkey";

-- AlterTable
ALTER TABLE "payment_items" DROP COLUMN "class_id",
DROP COLUMN "payment_description",
ADD COLUMN     "Description" TEXT NOT NULL,
ADD COLUMN     "account_name" TEXT NOT NULL,
ADD COLUMN     "account_number" VARCHAR(10) NOT NULL,
ADD COLUMN     "assigned_subclass" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "students" DROP COLUMN "class_id",
ADD COLUMN     "subclass_id" BIGINT NOT NULL;

-- DropTable
DROP TABLE "class";

-- CreateTable
CREATE TABLE "Subclasses" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "classId" BIGINT NOT NULL,
    "paymentItemId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subclasses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ClassCategory" NOT NULL DEFAULT 'normal',
    "description" TEXT NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subclasses_classId_name_key" ON "Subclasses"("classId", "name");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_subclass_id_fkey" FOREIGN KEY ("subclass_id") REFERENCES "Subclasses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subclasses" ADD CONSTRAINT "Subclasses_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subclasses" ADD CONSTRAINT "Subclasses_paymentItemId_fkey" FOREIGN KEY ("paymentItemId") REFERENCES "payment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `Description` on the `payment_items` table. All the data in the column will be lost.
  - You are about to drop the column `assigned_subclass` on the `payment_items` table. All the data in the column will be lost.
  - You are about to drop the column `classId` on the `subclasses` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `subclasses` table. All the data in the column will be lost.
  - You are about to drop the column `payment_item_id` on the `subclasses` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `subclasses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[class_id,name]` on the table `subclasses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `class_id` to the `payment_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `payment_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `class_id` to the `subclasses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `subclasses` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "subclasses" DROP CONSTRAINT "subclasses_classId_fkey";

-- DropForeignKey
ALTER TABLE "subclasses" DROP CONSTRAINT "subclasses_payment_item_id_fkey";

-- DropIndex
DROP INDEX "subclasses_classId_name_key";

-- AlterTable
ALTER TABLE "payment_items" DROP COLUMN "Description",
DROP COLUMN "assigned_subclass",
ADD COLUMN     "class_id" BIGINT NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subclasses" DROP COLUMN "classId",
DROP COLUMN "createdAt",
DROP COLUMN "payment_item_id",
DROP COLUMN "updatedAt",
ADD COLUMN     "class_id" BIGINT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "payment_item_subclasses" (
    "payment_item_id" BIGINT NOT NULL,
    "subclass_id" BIGINT NOT NULL,

    CONSTRAINT "payment_item_subclasses_pkey" PRIMARY KEY ("payment_item_id","subclass_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subclasses_class_id_name_key" ON "subclasses"("class_id", "name");

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_item_subclasses" ADD CONSTRAINT "payment_item_subclasses_payment_item_id_fkey" FOREIGN KEY ("payment_item_id") REFERENCES "payment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_item_subclasses" ADD CONSTRAINT "payment_item_subclasses_subclass_id_fkey" FOREIGN KEY ("subclass_id") REFERENCES "subclasses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

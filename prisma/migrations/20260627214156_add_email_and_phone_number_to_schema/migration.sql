-- AlterTable
ALTER TABLE "students" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone_number" TEXT;

-- Update existing rows to have placeholder values
UPDATE "students" SET "email" = 'placeholder_' || id::text || '@test.com' WHERE "email" IS NULL;
UPDATE "students" SET "phone_number" = '0000000' || id::text WHERE "phone_number" IS NULL;

-- Alter column to be required
ALTER TABLE "students" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "students" ALTER COLUMN "phone_number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");
CREATE UNIQUE INDEX "students_phone_number_key" ON "students"("phone_number");

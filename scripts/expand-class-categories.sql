-- Replace the old class categories (normal, ube) with the expanded set.
-- Existing classes are mapped to standardClass so the enum swap does not fail
-- on rows that still hold the old values.

-- Left behind by a failed `prisma db push`, if any
DROP TYPE IF EXISTS "ClassCategory_new";

CREATE TYPE "ClassCategory_new" AS ENUM ('standardClass', 'technical', 'university', 'polytechnic', 'collegeOfEducation');

ALTER TABLE "classes" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "classes" ALTER COLUMN "category" TYPE "ClassCategory_new"
  USING (
    CASE "category"::text
      WHEN 'normal' THEN 'standardClass'
      WHEN 'ube' THEN 'standardClass'
      ELSE "category"::text
    END
  )::"ClassCategory_new";

DROP TYPE "ClassCategory";
ALTER TYPE "ClassCategory_new" RENAME TO "ClassCategory";

ALTER TABLE "classes" ALTER COLUMN "category" SET DEFAULT 'standardClass';

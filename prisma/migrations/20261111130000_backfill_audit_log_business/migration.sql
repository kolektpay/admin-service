-- Older audit log writers did not record business_id. Fill it in wherever the
-- business can be worked out for certain, using the same rules the app now
-- applies to new rows. Rows where it cannot (an administrator in several
-- businesses, or in none) are left NULL rather than guessed.
-- Order matters: rows naming a student or guardian take that account's business
-- first, so an administrator's action on a student lands in the student's school.

-- 1. Rows about a student
UPDATE "auditlogs" a
SET "business_id" = s."business_id"
FROM "students" s
WHERE a."business_id" IS NULL
  AND a."student_id" = s."id";

-- 2. Rows about a guardian who has a business
UPDATE "auditlogs" a
SET "business_id" = g."business_id"
FROM "guardians" g
WHERE a."business_id" IS NULL
  AND a."guardian_id" = g."id"
  AND g."business_id" IS NOT NULL;

-- 3. Rows about a guardian without a business whose children all share one
UPDATE "auditlogs" a
SET "business_id" = c."business_id"
FROM (
  SELECT ghs."guardian_id", MIN(s."business_id") AS "business_id"
  FROM "guardian_has_students" ghs
  JOIN "students" s ON s."id" = ghs."student_id"
  GROUP BY ghs."guardian_id"
  HAVING COUNT(DISTINCT s."business_id") = 1
) c
WHERE a."business_id" IS NULL
  AND a."guardian_id" = c."guardian_id";

-- 4. Remaining administrator rows, for administrators in exactly one business
UPDATE "auditlogs" a
SET "business_id" = ub."business_id"
FROM (
  SELECT "user_id", MIN("business_id") AS "business_id"
  FROM "user_businesses"
  WHERE "business_id" IS NOT NULL
  GROUP BY "user_id"
  HAVING COUNT(DISTINCT "business_id") = 1
) ub
WHERE a."business_id" IS NULL
  AND a."user_id" = ub."user_id";

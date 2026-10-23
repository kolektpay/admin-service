-- A student can be removed from their subclass and left unassigned until an
-- admin places them in another one. The foreign key stays ON DELETE RESTRICT,
-- so deleting a subclass still never unassigns its students silently.
ALTER TABLE "students" ALTER COLUMN "subclass_id" DROP NOT NULL;

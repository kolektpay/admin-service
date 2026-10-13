-- CreateIndex
CREATE INDEX "students_business_id_deleted_at_created_at_idx" ON "students"("business_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "students_subclass_id_idx" ON "students"("subclass_id");

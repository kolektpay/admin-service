-- Audit log listings filter by business, student or guardian and sort newest
-- first. Only user_id and ip_address were indexed, so every listing scanned
-- and sorted the whole table. Indexes only; no data changes.

-- CreateIndex
CREATE INDEX "auditlogs_business_id_created_at_idx" ON "auditlogs"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "auditlogs_student_id_created_at_idx" ON "auditlogs"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "auditlogs_guardian_id_created_at_idx" ON "auditlogs"("guardian_id", "created_at");

-- CreateIndex
CREATE INDEX "auditlogs_created_at_idx" ON "auditlogs"("created_at");

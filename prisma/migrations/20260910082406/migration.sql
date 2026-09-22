-- AddForeignKey
ALTER TABLE "auditlogs" ADD CONSTRAINT "auditlogs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

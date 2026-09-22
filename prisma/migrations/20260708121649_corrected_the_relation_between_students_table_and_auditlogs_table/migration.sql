-- AddForeignKey
ALTER TABLE "auditlogs" ADD CONSTRAINT "auditlogs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

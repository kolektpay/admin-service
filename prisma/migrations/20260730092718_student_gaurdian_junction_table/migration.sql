-- CreateTable
CREATE TABLE "guardian_has_students" (
    "id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "guardian_id" BIGINT NOT NULL,

    CONSTRAINT "guardian_has_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_has_students_student_id_guardian_id_key" ON "guardian_has_students"("student_id", "guardian_id");

-- AddForeignKey
ALTER TABLE "guardian_has_students" ADD CONSTRAINT "guardian_has_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_has_students" ADD CONSTRAINT "guardian_has_students_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "student_tokens" (
    "id" BIGSERIAL NOT NULL,
    "token_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "student_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_tokens_token_id_key" ON "student_tokens"("token_id");

-- AddForeignKey
ALTER TABLE "student_tokens" ADD CONSTRAINT "student_tokens_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

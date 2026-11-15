-- Records who performed each audited action and what they did, as fixed codes.
--
-- user_id / student_id / guardian_id only say which accounts a row involves, so
-- "admin blocked student 9" and "student 9 logged in" could not be told apart.
-- actor_type says who acted; target_type / target_id say what they acted on.
-- action replaces matching on the free-text status (which made "blocked" match
-- "unblocked"). Existing rows are backfilled; status itself is left untouched
-- so the original record is preserved.
--
-- Columns stay nullable so a service still running the previous code can keep
-- writing rows during a rolling deploy.

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('admin', 'student', 'guardian', 'anonymous', 'system');

-- AlterTable
ALTER TABLE "auditlogs"
  ADD COLUMN "actor_type" "AuditActorType",
  ADD COLUMN "action" VARCHAR(100),
  ADD COLUMN "target_type" VARCHAR(50),
  ADD COLUMN "target_id" VARCHAR(64),
  ADD COLUMN "user_agent" VARCHAR(500),
  ADD COLUMN "http_method" VARCHAR(10),
  ADD COLUMN "path" VARCHAR(255),
  ADD COLUMN "request_id" VARCHAR(100),
  ADD COLUMN "metadata" JSONB;

-- ==========================================
-- Backfill: who acted
-- An administrator on the row acted (on the student/guardian, if any). Without
-- one, a guardian acted (e.g. editing a child's permissions), else a student.
-- ==========================================
UPDATE "auditlogs"
SET "actor_type" = CASE
  WHEN "user_id" IS NOT NULL THEN 'admin'::"AuditActorType"
  WHEN "guardian_id" IS NOT NULL THEN 'guardian'::"AuditActorType"
  WHEN "student_id" IS NOT NULL THEN 'student'::"AuditActorType"
  ELSE 'anonymous'::"AuditActorType"
END;

-- ==========================================
-- Backfill: what they acted on
-- ==========================================
UPDATE "auditlogs"
SET "target_type" = 'student', "target_id" = "student_id"::TEXT
WHERE "student_id" IS NOT NULL
  AND "actor_type" IN ('admin', 'guardian');

UPDATE "auditlogs"
SET "target_type" = 'guardian', "target_id" = "guardian_id"::TEXT
WHERE "guardian_id" IS NOT NULL
  AND "actor_type" = 'admin'
  AND "target_type" IS NULL;

-- ==========================================
-- Backfill: action codes, from every status text both services have written
-- ==========================================
UPDATE "auditlogs"
SET "action" = CASE
  -- Sign-in and account security
  WHEN "status" = 'successful_login_attempt' THEN 'auth.login_succeeded'
  WHEN "status" = 'failed_login_attempt' THEN 'auth.login_failed'
  WHEN "status" IN ('user_logout', 'student_logout', 'guardian_logout') THEN 'auth.logout'
  WHEN "status" IN ('password_change', 'This user has successfully changed his password.') THEN 'auth.password_changed'
  WHEN "status" = 'forgot_password_operation_was_successful' THEN 'auth.password_forgot_requested'
  WHEN "status" = 'reset_password_operation_was_successful' THEN 'auth.password_reset'
  WHEN "status" = 'must_change_password_operation_was_successful' THEN 'auth.temporary_password_changed'
  WHEN "status" = 'Password rotation enforcement message log information.' THEN 'auth.password_rotation_enforced'
  WHEN "status" = 'request_to_setup_2fa_operation_was_successful' THEN 'auth.two_factor_setup'
  WHEN "status" = 'request_to_enable_2fa_operation_was_successful' THEN 'auth.two_factor_enabled'
  WHEN "status" = 'user_account_unblocked' THEN 'auth.account_unlocked'
  WHEN "status" LIKE 'user\_account\_blocked due to%' THEN 'auth.account_locked'
  -- An administrator blocking a student, vs. a student or guardian locked out
  -- by failed logins (user-service wrote both students and guardians as
  -- "student_account_blocked")
  WHEN "status" LIKE 'student\_account\_blocked%' AND "actor_type" = 'admin' THEN 'student.blocked'
  WHEN "status" LIKE 'student\_account\_blocked%' THEN 'auth.account_locked'
  WHEN "status" LIKE 'student\_account\_unblocked%' THEN 'student.unblocked'

  -- Audit logs
  WHEN "status" = 'request_to_view_audit_logs' THEN 'audit_logs.viewed'

  -- Administrators and roles
  WHEN "status" = 'request_to_get_every_user' THEN 'admin.listed'
  WHEN "status" = 'request_to_get_user_by_unique_id' THEN 'admin.viewed'
  WHEN "status" = 'request_to_create_a_new_user' OR "status" LIKE 'admin\_created:%' THEN 'admin.created'
  WHEN "status" = 'request_to_update_existing_user_details' OR "status" LIKE 'admin\_updated:%' THEN 'admin.updated'
  WHEN "status" = 'request_to_delete_an_existing_user' OR "status" LIKE 'admin\_deleted:%' THEN 'admin.deleted'
  WHEN "status" = 'request_to_assign_role_to_user' THEN 'admin.role_assigned'
  WHEN "status" LIKE 'admin\_roles\_changed:%' THEN 'admin.roles_changed'
  WHEN "status" LIKE 'admin\_status\_changed:%' THEN 'admin.status_changed'
  WHEN "status" LIKE 'role\_created:%' THEN 'role.created'
  WHEN "status" LIKE 'role\_deleted:%' THEN 'role.deleted'
  WHEN "status" LIKE 'role\_permissions\_updated:%' THEN 'role.permissions_updated'

  -- Business onboarding and bank accounts
  WHEN "status" = 'manager_creation_operation_was_successful' THEN 'manager.created'
  WHEN "status" = 'manager_business_creation_operation_was_successful' THEN 'business.created'
  WHEN "status" = 'manager_business_bank_creation_operation_was_successful' THEN 'business.bank_added'
  WHEN "status" = 'All bank accounts for this business successfully retrieved' THEN 'business.banks_listed'
  WHEN "status" = 'Bank account for this business successfully deleted' THEN 'business.bank_deleted'
  WHEN "status" = 'Bank account for this business successfully updated to active' THEN 'business.bank_activated'
  WHEN "status" = 'Current active bank info retrieved' THEN 'business.active_bank_viewed'

  -- Wallets, payment links and payment items
  WHEN "status" = 'All_wallet_details_successfully_gotten_for_this_user' THEN 'wallet.details_viewed'
  WHEN "status" LIKE '%created a wallet for a new student' THEN 'wallet.student_wallet_created'
  WHEN "status" = 'student_set_wallet_pin' THEN 'wallet.pin_set'
  WHEN "status" = 'Payment_link_successfully_generated' THEN 'payment_link.generated'
  WHEN "status" = 'All_generated_payment_links_retrieved' THEN 'payment_link.listed'
  WHEN "status" = 'payment_item_creation' THEN 'payment_item.created'
  WHEN "status" = 'payment_item_approval' THEN 'payment_item.approved'

  -- Students and guardians
  WHEN "status" IN ('student_created_via_bulk_upload', 'This user has successfully created a new student entry on the student table.') THEN 'student.created'
  WHEN "status" LIKE 'student\_info\_updated:%' OR "status" LIKE '%updated student info' THEN 'student.updated'
  WHEN "status" = 'student_deleted' THEN 'student.deleted'
  -- (sic) logUserCreatedNewGuardianEntry wrote "student entry on the guardians table"
  WHEN "status" = 'This user has successfully created a new student entry on the guardians table.' THEN 'guardian.created'
  WHEN "status" LIKE '%updated guardian info' THEN 'guardian.updated'
  -- user-service also wrote this text for deleting a student, so some of these may be student deletions
  WHEN "status" LIKE '%deleted guardian info' THEN 'guardian.deleted'
  WHEN "status" = 'guardian_edited_student_permissions' THEN 'guardian.student_permissions_updated'

  -- Classes, subclasses and class assignments, e.g. "class_created: 16 (JSS 10)"
  -- becomes class.created and "student_subclass_assigned: ..." student.subclass_assigned
  WHEN "status" ~ '^(class|subclass|students|student)_[a-z_]+:' THEN
    regexp_replace(split_part("status", ':', 1), '^(class|subclass|students|student)_', '\1.')

  ELSE 'legacy.unmapped'
END;

-- CreateIndex
CREATE INDEX "auditlogs_business_id_actor_type_created_at_idx" ON "auditlogs"("business_id", "actor_type", "created_at");

-- CreateIndex
CREATE INDEX "auditlogs_action_idx" ON "auditlogs"("action");

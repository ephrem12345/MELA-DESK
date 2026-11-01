-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('REQUESTER', 'AGENT', 'TEAM_LEAD', 'ADMIN') NOT NULL DEFAULT 'REQUESTER',
    `department_id` CHAR(36) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `email_verified_at` DATETIME(3) NULL,
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `preferred_language` VARCHAR(5) NOT NULL DEFAULT 'en',
    `time_zone` VARCHAR(80) NOT NULL DEFAULT 'UTC',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_active_idx`(`role`, `active`),
    INDEX `users_department_id_active_idx`(`department_id`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `description` VARCHAR(500) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_name_key`(`name`),
    UNIQUE INDEX `departments_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teams` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `department_id` CHAR(36) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `teams_name_key`(`name`),
    INDEX `teams_department_id_active_idx`(`department_id`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_members` (
    `team_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `membership_role` VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `team_members_user_id_active_idx`(`user_id`, `active`),
    PRIMARY KEY (`team_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_categories` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `label_en` VARCHAR(160) NOT NULL,
    `label_am` VARCHAR(160) NOT NULL,
    `description` VARCHAR(500) NULL,
    `parent_id` CHAR(36) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ticket_categories_name_key`(`name`),
    INDEX `ticket_categories_active_display_order_idx`(`active`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_priorities` (
    `id` CHAR(36) NOT NULL,
    `code` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `level` INTEGER NOT NULL,
    `first_response_minutes` INTEGER NOT NULL,
    `resolution_minutes` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ticket_priorities_code_key`(`code`),
    UNIQUE INDEX `ticket_priorities_name_key`(`name`),
    UNIQUE INDEX `ticket_priorities_level_key`(`level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_sequences` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `last_value` BIGINT NOT NULL DEFAULT 999,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `id` CHAR(36) NOT NULL,
    `ticket_number` VARCHAR(24) NOT NULL,
    `subject` VARCHAR(240) NOT NULL,
    `description` TEXT NOT NULL,
    `requester_id` CHAR(36) NOT NULL,
    `assigned_agent_id` CHAR(36) NULL,
    `assigned_team_id` CHAR(36) NULL,
    `department_id` CHAR(36) NULL,
    `category_id` CHAR(36) NOT NULL,
    `priority_id` CHAR(36) NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'PENDING_REQUESTER', 'PENDING_THIRD_PARTY', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `channel` VARCHAR(24) NOT NULL DEFAULT 'WEB',
    `service` VARCHAR(120) NULL,
    `impact` VARCHAR(24) NULL,
    `urgency` VARCHAR(24) NULL,
    `due_at` DATETIME(3) NULL,
    `first_response_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `resolution_summary` TEXT NULL,
    `resolution_code` VARCHAR(80) NULL,
    `root_cause` TEXT NULL,
    `corrective_action` TEXT NULL,
    `preventive_action` TEXT NULL,
    `public_explanation` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tickets_ticket_number_key`(`ticket_number`),
    INDEX `tickets_status_updated_at_idx`(`status`, `updated_at`),
    INDEX `tickets_priority_id_status_updated_at_idx`(`priority_id`, `status`, `updated_at`),
    INDEX `tickets_requester_id_created_at_idx`(`requester_id`, `created_at`),
    INDEX `tickets_assigned_agent_id_status_updated_at_idx`(`assigned_agent_id`, `status`, `updated_at`),
    INDEX `tickets_assigned_team_id_status_updated_at_idx`(`assigned_team_id`, `status`, `updated_at`),
    INDEX `tickets_department_id_status_created_at_idx`(`department_id`, `status`, `created_at`),
    INDEX `tickets_category_id_created_at_idx`(`category_id`, `created_at`),
    INDEX `tickets_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_status_history` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NOT NULL,
    `previous_status` ENUM('OPEN', 'IN_PROGRESS', 'PENDING_REQUESTER', 'PENDING_THIRD_PARTY', 'RESOLVED', 'CLOSED') NULL,
    `new_status` ENUM('OPEN', 'IN_PROGRESS', 'PENDING_REQUESTER', 'PENDING_THIRD_PARTY', 'RESOLVED', 'CLOSED') NOT NULL,
    `changed_by` CHAR(36) NULL,
    `reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_status_history_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_assignments` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NOT NULL,
    `assigned_to_user_id` CHAR(36) NULL,
    `assigned_to_team_id` CHAR(36) NULL,
    `assigned_by` CHAR(36) NULL,
    `reason` VARCHAR(500) NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unassigned_at` DATETIME(3) NULL,

    INDEX `ticket_assignments_ticket_id_assigned_at_idx`(`ticket_id`, `assigned_at`),
    INDEX `ticket_assignments_assigned_to_user_id_unassigned_at_idx`(`assigned_to_user_id`, `unassigned_at`),
    INDEX `ticket_assignments_assigned_to_team_id_unassigned_at_idx`(`assigned_to_team_id`, `unassigned_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_comments` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NOT NULL,
    `author_id` CHAR(36) NOT NULL,
    `body` TEXT NOT NULL,
    `visibility` ENUM('PUBLIC', 'INTERNAL') NOT NULL DEFAULT 'PUBLIC',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `ticket_comments_ticket_id_visibility_created_at_idx`(`ticket_id`, `visibility`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_attachments` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NULL,
    `comment_id` CHAR(36) NULL,
    `uploaded_by` CHAR(36) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `storage_key` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `file_size_bytes` BIGINT NOT NULL,
    `checksum` CHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,

    UNIQUE INDEX `ticket_attachments_storage_key_key`(`storage_key`),
    INDEX `ticket_attachments_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
    INDEX `ticket_attachments_uploaded_by_expires_at_idx`(`uploaded_by`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `recipient_id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NULL,
    `type` VARCHAR(48) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `locale` VARCHAR(5) NOT NULL DEFAULT 'en',
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_recipient_id_read_at_created_at_idx`(`recipient_id`, `read_at`, `created_at`),
    INDEX `notifications_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sla_policies` (
    `id` CHAR(36) NOT NULL,
    `priority_id` CHAR(36) NOT NULL,
    `warning_minutes` INTEGER NOT NULL DEFAULT 60,
    `time_zone` VARCHAR(80) NOT NULL DEFAULT 'UTC',
    `business_hours_enabled` BOOLEAN NOT NULL DEFAULT false,
    `business_hours` JSON NULL,
    `holidays` JSON NULL,
    `pause_when_pending` BOOLEAN NOT NULL DEFAULT false,
    `escalation_rules` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sla_policies_priority_id_key`(`priority_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sla_tracking` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NOT NULL,
    `first_response_due_at` DATETIME(3) NULL,
    `resolution_due_at` DATETIME(3) NULL,
    `first_response_breached_at` DATETIME(3) NULL,
    `resolution_breached_at` DATETIME(3) NULL,
    `first_response_warning_sent_at` DATETIME(3) NULL,
    `resolution_warning_sent_at` DATETIME(3) NULL,
    `paused_at` DATETIME(3) NULL,
    `accumulated_pause_minutes` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sla_tracking_ticket_id_key`(`ticket_id`),
    INDEX `sla_tracking_resolution_due_at_resolution_breached_at_idx`(`resolution_due_at`, `resolution_breached_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip_address` VARCHAR(64) NULL,
    `user_agent` VARCHAR(500) NULL,

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_revoked_at_expires_at_idx`(`user_id`, `revoked_at`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_expires_at_consumed_at_idx`(`user_id`, `expires_at`, `consumed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_verification_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_verification_tokens_token_hash_key`(`token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `resource_type` VARCHAR(80) NOT NULL,
    `resource_id` VARCHAR(80) NULL,
    `request_id` VARCHAR(64) NOT NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` VARCHAR(500) NULL,
    `before_data` JSON NULL,
    `after_data` JSON NULL,
    `outcome` VARCHAR(24) NOT NULL DEFAULT 'SUCCESS',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    INDEX `audit_logs_resource_type_resource_id_created_at_idx`(`resource_type`, `resource_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    INDEX `audit_logs_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbox_events` (
    `id` CHAR(36) NOT NULL,
    `event_key` VARCHAR(180) NOT NULL,
    `topic` VARCHAR(120) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `max_attempts` INTEGER NOT NULL DEFAULT 8,
    `claimed_at` DATETIME(3) NULL,
    `next_attempt_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `last_error` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `outbox_events_event_key_key`(`event_key`),
    INDEX `outbox_events_status_next_attempt_at_idx`(`status`, `next_attempt_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_records` (
    `id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NOT NULL,
    `key` VARCHAR(128) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `response` JSON NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idempotency_records_expires_at_idx`(`expires_at`),
    UNIQUE INDEX `idempotency_records_actor_id_key_key`(`actor_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_preferences` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `email_enabled` BOOLEAN NOT NULL DEFAULT true,
    `assignment_enabled` BOOLEAN NOT NULL DEFAULT true,
    `reply_enabled` BOOLEAN NOT NULL DEFAULT true,
    `status_enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_preferences_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `key` VARCHAR(120) NOT NULL,
    `value` JSON NOT NULL,
    `updated_by` CHAR(36) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `teams_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_categories` ADD CONSTRAINT `ticket_categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `ticket_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_requester_id_fkey` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assigned_agent_id_fkey` FOREIGN KEY (`assigned_agent_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assigned_team_id_fkey` FOREIGN KEY (`assigned_team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `ticket_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_priority_id_fkey` FOREIGN KEY (`priority_id`) REFERENCES `ticket_priorities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_status_history` ADD CONSTRAINT `ticket_status_history_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_status_history` ADD CONSTRAINT `ticket_status_history_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_assigned_to_user_id_fkey` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_assigned_to_team_id_fkey` FOREIGN KEY (`assigned_to_team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_comments` ADD CONSTRAINT `ticket_comments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_comments` ADD CONSTRAINT `ticket_comments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_comment_id_fkey` FOREIGN KEY (`comment_id`) REFERENCES `ticket_comments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipient_id_fkey` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sla_policies` ADD CONSTRAINT `sla_policies_priority_id_fkey` FOREIGN KEY (`priority_id`) REFERENCES `ticket_priorities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sla_tracking` ADD CONSTRAINT `sla_tracking_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `email_verification_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

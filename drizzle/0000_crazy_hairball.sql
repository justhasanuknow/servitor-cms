CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	`verified` integer DEFAULT true,
	`failed_verification_count` integer DEFAULT 0,
	`locked_until` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `twoFactor_secret_idx` ON `two_factor` (`secret`);--> statement-breakpoint
CREATE INDEX `twoFactor_userId_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`two_factor_enabled` integer DEFAULT false,
	`role` text DEFAULT 'author' NOT NULL,
	`can_publish_directly` integer DEFAULT false NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`deactivated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `api_key_categories` (
	`api_key_id` text NOT NULL,
	`category_id` text NOT NULL,
	PRIMARY KEY(`api_key_id`, `category_id`),
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_key_languages` (
	`api_key_id` text NOT NULL,
	`language_code` text NOT NULL,
	PRIMARY KEY(`api_key_id`, `language_code`),
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`language_code`) REFERENCES `content_languages`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`all_languages` integer DEFAULT true NOT NULL,
	`all_categories` integer DEFAULT true NOT NULL,
	`rate_limit_per_minute` integer,
	`expires_at` integer,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "api_keys_rate_limit" CHECK(rate_limit_per_minute is null or rate_limit_per_minute > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `cors_origins` (
	`id` text PRIMARY KEY NOT NULL,
	`origin` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cors_origins_origin_unique` ON `cors_origins` (`origin`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`ip` text,
	`user_agent` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`details` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "audit_log_actor_type" CHECK(actor_type in ('user', 'anonymous', 'cli', 'system')),
	CONSTRAINT "audit_log_actor" CHECK((actor_type = 'user') = (actor_id is not null))
);
--> statement-breakpoint
CREATE INDEX `audit_log_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_actor` ON `audit_log` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_action` ON `audit_log` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_target` ON `audit_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `category_translations` (
	`category_id` text NOT NULL,
	`language_code` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`category_id`, `language_code`),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`language_code`) REFERENCES `content_languages`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_translations_language_slug` ON `category_translations` (`language_code`,`slug`);--> statement-breakpoint
CREATE TABLE `content_languages` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`native_name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "content_languages_default_enabled" CHECK(is_default = 0 or enabled = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_languages_single_default` ON `content_languages` (`is_default`) WHERE is_default = 1;--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text DEFAULT 'library' NOT NULL,
	`source_format` text NOT NULL,
	`animated` integer DEFAULT false NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "media_kind" CHECK(kind in ('library', 'avatar')),
	CONSTRAINT "media_source_format" CHECK(source_format in ('jpeg', 'png', 'webp', 'gif', 'avif')),
	CONSTRAINT "media_dimensions" CHECK(width > 0 and height > 0 and byte_size > 0)
);
--> statement-breakpoint
CREATE INDEX `media_owner` ON `media` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `media_alt_texts` (
	`media_id` text NOT NULL,
	`language_code` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`media_id`, `language_code`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`language_code`) REFERENCES `content_languages`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_revision_media` (
	`revision_id` text NOT NULL,
	`media_id` text NOT NULL,
	PRIMARY KEY(`revision_id`, `media_id`),
	FOREIGN KEY (`revision_id`) REFERENCES `post_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_revision_media_media` ON `post_revision_media` (`media_id`);--> statement-breakpoint
CREATE TABLE `post_revision_tags` (
	`revision_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`revision_id`, `tag_id`),
	FOREIGN KEY (`revision_id`) REFERENCES `post_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_revision_tags_tag` ON `post_revision_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `post_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`translation_id` text NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`meta_title` text,
	`meta_description` text,
	`og_media_id` text,
	`content_json` text NOT NULL,
	`content_html` text NOT NULL,
	`content_text` text NOT NULL,
	`reading_time_minutes` integer NOT NULL,
	`review_state` text DEFAULT 'none' NOT NULL,
	`review_note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`translation_id`) REFERENCES `post_translations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`og_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "post_revisions_review_state" CHECK(review_state in ('none', 'pending', 'approved', 'rejected')),
	CONSTRAINT "post_revisions_rejection_note" CHECK(review_state <> 'rejected' or review_note is not null),
	CONSTRAINT "post_revisions_reading_time" CHECK(reading_time_minutes >= 0)
);
--> statement-breakpoint
CREATE INDEX `post_revisions_translation` ON `post_revisions` (`translation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `post_revisions_og_media` ON `post_revisions` (`og_media_id`);--> statement-breakpoint
CREATE TABLE `post_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`language_code` text NOT NULL,
	`slug` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`working_revision_id` text,
	`pending_revision_id` text,
	`live_revision_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`language_code`) REFERENCES `content_languages`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`working_revision_id`) REFERENCES `post_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pending_revision_id`) REFERENCES `post_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`live_revision_id`) REFERENCES `post_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "post_translations_status" CHECK(status in ('draft', 'pending_review', 'scheduled', 'published', 'unpublished')),
	CONSTRAINT "post_translations_live_revision" CHECK(status in ('draft', 'pending_review') or live_revision_id is not null),
	CONSTRAINT "post_translations_live_slug" CHECK(live_revision_id is null or slug is not null),
	CONSTRAINT "post_translations_scheduled_at" CHECK(status <> 'scheduled' or scheduled_at is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_translations_post_language` ON `post_translations` (`post_id`,`language_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `post_translations_language_slug` ON `post_translations` (`language_code`,`slug`);--> statement-breakpoint
CREATE INDEX `post_translations_schedule` ON `post_translations` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `post_translations_listing` ON `post_translations` (`language_code`,`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`category_id` text,
	`cover_media_id` text,
	`hidden_by_moderator` integer DEFAULT false NOT NULL,
	`hidden_by` text,
	`hidden_reason` text,
	`hidden_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hidden_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "posts_moderation" CHECK((hidden_by_moderator = 0 and hidden_by is null and hidden_reason is null and hidden_at is null) or (hidden_by_moderator = 1 and hidden_by is not null and hidden_reason is not null and hidden_at is not null))
);
--> statement-breakpoint
CREATE INDEX `posts_owner` ON `posts` (`owner_id`);--> statement-breakpoint
CREATE INDEX `posts_category` ON `posts` (`category_id`);--> statement-breakpoint
CREATE INDEX `posts_cover_media` ON `posts` (`cover_media_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`language_code` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`language_code`) REFERENCES `content_languages`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_language_slug` ON `tags` (`language_code`,`slug`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`site_name` text DEFAULT 'Servitor CMS' NOT NULL,
	`public_site_enabled` integer DEFAULT true NOT NULL,
	`require_two_factor_for_admins` integer DEFAULT false NOT NULL,
	`default_api_rate_limit` integer DEFAULT 120 NOT NULL,
	`revision_retention` integer DEFAULT 50 NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "system_settings_singleton" CHECK(id = 1),
	CONSTRAINT "system_settings_api_rate_limit" CHECK(default_api_rate_limit > 0),
	CONSTRAINT "system_settings_revision_retention" CHECK(revision_retention > 0)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`bio` text,
	`avatar_media_id` text,
	`ui_locale` text,
	`theme_palette` text DEFAULT 'neutral' NOT NULL,
	`theme_mode` text DEFAULT 'system' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`avatar_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "user_profiles_ui_locale" CHECK(ui_locale is null or ui_locale in ('en', 'tr', 'fr', 'de', 'ja', 'zh-Hans')),
	CONSTRAINT "user_profiles_theme_palette" CHECK(theme_palette in ('neutral', 'red', 'blue', 'green', 'pink')),
	CONSTRAINT "user_profiles_theme_mode" CHECK(theme_mode in ('light', 'dark', 'system'))
);
--> statement-breakpoint
CREATE INDEX `user_profiles_avatar` ON `user_profiles` (`avatar_media_id`);--> statement-breakpoint
CREATE TABLE `user_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`token_hash` text NOT NULL,
	`new_email` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "user_tokens_type" CHECK(type in ('invite', 'password_reset', 'email_change')),
	CONSTRAINT "user_tokens_new_email" CHECK((type = 'email_change') = (new_email is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_tokens_token_hash_unique` ON `user_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `user_tokens_user_type` ON `user_tokens` (`user_id`,`type`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "webhook_deliveries_event" CHECK(event in ('post.published', 'post.updated', 'post.unpublished', 'post.hidden', 'post.unhidden', 'post.deleted')),
	CONSTRAINT "webhook_deliveries_status" CHECK(status in ('pending', 'delivering', 'succeeded', 'failed')),
	CONSTRAINT "webhook_deliveries_attempt_count" CHECK(attempt_count >= 0)
);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_queue` ON `webhook_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_webhook` ON `webhook_deliveries` (`webhook_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `webhook_delivery_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_id` text NOT NULL,
	`status_code` integer,
	`duration_ms` integer NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`delivery_id`) REFERENCES `webhook_deliveries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_delivery_attempts_delivery` ON `webhook_delivery_attempts` (`delivery_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`events` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`secret_ciphertext` text NOT NULL,
	`secret_rotated_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

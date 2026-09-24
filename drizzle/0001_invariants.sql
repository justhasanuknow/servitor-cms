CREATE UNIQUE INDEX `user_single_founder` ON `user` (`role`) WHERE role = 'founder';
--> statement-breakpoint
CREATE TRIGGER `user_validate_insert` BEFORE INSERT ON `user`
BEGIN
	SELECT RAISE(ABORT, 'invalid user role') WHERE NEW.role NOT IN ('founder', 'admin', 'author');
	SELECT RAISE(ABORT, 'the founder cannot be deactivated') WHERE NEW.role = 'founder' AND NEW.deactivated_at IS NOT NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `user_validate_update` BEFORE UPDATE ON `user`
BEGIN
	SELECT RAISE(ABORT, 'invalid user role') WHERE NEW.role NOT IN ('founder', 'admin', 'author');
	SELECT RAISE(ABORT, 'the founder role cannot be changed') WHERE (OLD.role = 'founder') <> (NEW.role = 'founder');
	SELECT RAISE(ABORT, 'the founder cannot be deactivated') WHERE NEW.role = 'founder' AND NEW.deactivated_at IS NOT NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `user_prevent_delete` BEFORE DELETE ON `user`
BEGIN
	SELECT RAISE(ABORT, 'users cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `content_languages_keep_default` BEFORE DELETE ON `content_languages`
WHEN OLD.is_default = 1
BEGIN
	SELECT RAISE(ABORT, 'the default content language cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_log_prevent_update` BEFORE UPDATE ON `audit_log`
BEGIN
	SELECT RAISE(ABORT, 'the audit log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_log_prevent_delete` BEFORE DELETE ON `audit_log`
BEGIN
	SELECT RAISE(ABORT, 'the audit log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `system_settings_prevent_delete` BEFORE DELETE ON `system_settings`
BEGIN
	SELECT RAISE(ABORT, 'system settings cannot be deleted');
END;
--> statement-breakpoint
INSERT INTO `system_settings` (`id`) VALUES (1);

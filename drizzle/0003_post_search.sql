CREATE VIRTUAL TABLE `post_search` USING fts5(
	`translation_id` UNINDEXED,
	`title`,
	`excerpt`,
	`content_text`,
	tokenize = 'trigram remove_diacritics 1'
);
--> statement-breakpoint
INSERT INTO `post_search` (`translation_id`, `title`, `excerpt`, `content_text`)
SELECT `post_translations`.`id`, `post_revisions`.`title`, `post_revisions`.`excerpt`, `post_revisions`.`content_text`
FROM `post_translations`
INNER JOIN `post_revisions` ON `post_revisions`.`id` = `post_translations`.`live_revision_id`;
--> statement-breakpoint
CREATE TRIGGER `post_search_after_insert` AFTER INSERT ON `post_translations`
WHEN NEW.`live_revision_id` IS NOT NULL
BEGIN
	INSERT INTO `post_search` (`translation_id`, `title`, `excerpt`, `content_text`)
	SELECT NEW.`id`, `title`, `excerpt`, `content_text` FROM `post_revisions` WHERE `id` = NEW.`live_revision_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `post_search_after_update` AFTER UPDATE OF `live_revision_id` ON `post_translations`
WHEN OLD.`live_revision_id` IS NOT NEW.`live_revision_id`
BEGIN
	DELETE FROM `post_search` WHERE `translation_id` = OLD.`id`;
	INSERT INTO `post_search` (`translation_id`, `title`, `excerpt`, `content_text`)
	SELECT NEW.`id`, `title`, `excerpt`, `content_text` FROM `post_revisions` WHERE `id` = NEW.`live_revision_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `post_search_after_delete` AFTER DELETE ON `post_translations`
BEGIN
	DELETE FROM `post_search` WHERE `translation_id` = OLD.`id`;
END;

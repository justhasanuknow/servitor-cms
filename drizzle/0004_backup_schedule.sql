CREATE TABLE `backup_schedule` (
	`id` integer PRIMARY KEY NOT NULL,
	`frequency` text DEFAULT 'off' NOT NULL,
	`hour` integer DEFAULT 3 NOT NULL,
	`retention` integer DEFAULT 7 NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "backup_schedule_singleton" CHECK(id = 1),
	CONSTRAINT "backup_schedule_frequency" CHECK(frequency in ('off', 'daily', 'weekly')),
	CONSTRAINT "backup_schedule_hour" CHECK(hour between 0 and 23),
	CONSTRAINT "backup_schedule_retention" CHECK(retention between 1 and 365)
);

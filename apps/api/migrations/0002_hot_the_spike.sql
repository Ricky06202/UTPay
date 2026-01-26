CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`contact_name` text NOT NULL,
	`wallet_address` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mission_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mission_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`status` text DEFAULT 'pending',
	`bid_amount` real NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_mission_applications`("id", "mission_id", "student_id", "status", "bid_amount", "comment", "created_at") SELECT "id", "mission_id", "student_id", "status", "bid_amount", "comment", "created_at" FROM `mission_applications`;--> statement-breakpoint
DROP TABLE `mission_applications`;--> statement-breakpoint
ALTER TABLE `__new_mission_applications` RENAME TO `mission_applications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `users` ADD `wallet_address` text;--> statement-breakpoint
ALTER TABLE `missions` DROP COLUMN `slots`;
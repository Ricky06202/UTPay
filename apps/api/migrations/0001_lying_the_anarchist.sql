CREATE TABLE `mission_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mission_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`status` text DEFAULT 'pending',
	`comment` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mission_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mission_categories_name_unique` ON `mission_categories` (`name`);--> statement-breakpoint
CREATE TABLE `missions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category_id` integer NOT NULL,
	`reward` real NOT NULL,
	`slots` integer DEFAULT 1,
	`whatsapp` text,
	`status` text DEFAULT 'open',
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `mission_categories`(`id`) ON UPDATE no action ON DELETE no action
);

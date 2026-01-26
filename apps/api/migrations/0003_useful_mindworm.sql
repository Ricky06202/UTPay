PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`contact_name` text NOT NULL,
	`wallet_address` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_contacts`("id", "user_id", "contact_name", "wallet_address", "created_at") SELECT "id", "user_id", "contact_name", "wallet_address", "created_at" FROM `contacts`;--> statement-breakpoint
DROP TABLE `contacts`;--> statement-breakpoint
ALTER TABLE `__new_contacts` RENAME TO `contacts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_missions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category_id` integer NOT NULL,
	`reward` real NOT NULL,
	`whatsapp` text,
	`status` text DEFAULT 'open',
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `mission_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_missions`("id", "creator_id", "title", "description", "category_id", "reward", "whatsapp", "status", "created_at") SELECT "id", "creator_id", "title", "description", "category_id", "reward", "whatsapp", "status", "created_at" FROM `missions`;--> statement-breakpoint
DROP TABLE `missions`;--> statement-breakpoint
ALTER TABLE `__new_missions` RENAME TO `missions`;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tx_hash` text NOT NULL,
	`sender_id` integer,
	`receiver_id` integer,
	`sender_email` text,
	`receiver_email` text,
	`amount` real NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending',
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "tx_hash", "sender_id", "receiver_id", "sender_email", "receiver_email", "amount", "description", "status", "created_at") SELECT "id", "tx_hash", "sender_id", "receiver_id", "sender_email", "receiver_email", "amount", "description", "status", "created_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_tx_hash_unique` ON `transactions` (`tx_hash`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `balance`;
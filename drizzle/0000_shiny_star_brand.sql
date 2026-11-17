CREATE TABLE `claims` (
	`token` text PRIMARY KEY NOT NULL,
	`device` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` integer PRIMARY KEY NOT NULL,
	`payload` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);

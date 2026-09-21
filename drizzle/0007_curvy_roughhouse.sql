CREATE TABLE `manager_clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerId` int NOT NULL,
	`clientId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manager_clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `managers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managers_id` PRIMARY KEY(`id`),
	CONSTRAINT `managers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `publicToken` varchar(64);
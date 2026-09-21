CREATE TABLE `report_chat_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_chat_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`introText` text,
	`tone` varchar(50) DEFAULT 'profissional',
	`showSections` json,
	`customInstructions` text,
	`lastUpdatedBy` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `report_config_clientId_unique` UNIQUE(`clientId`)
);

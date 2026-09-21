CREATE TABLE `before_after_creatives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`pairId` int NOT NULL,
	`briefId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`generationPrompt` text NOT NULL,
	`aspectRatio` varchar(20) NOT NULL DEFAULT '4:5',
	`status` enum('generated','approved','rejected') NOT NULL DEFAULT 'generated',
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `before_after_creatives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `before_after_pairs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`beforeUrl` text NOT NULL,
	`afterUrl` text NOT NULL,
	`consentConfirmed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `before_after_pairs_id` PRIMARY KEY(`id`)
);

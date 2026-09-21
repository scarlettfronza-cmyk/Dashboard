CREATE TABLE `creative_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`briefId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`generationPrompt` text NOT NULL,
	`aspectRatio` varchar(20) NOT NULL DEFAULT '4:5',
	`status` enum('generated','approved','rejected') NOT NULL DEFAULT 'generated',
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creative_assets_id` PRIMARY KEY(`id`)
);

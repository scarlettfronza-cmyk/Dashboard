CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`provider` enum('meta_ads','monday') NOT NULL,
	`accessToken` text,
	`adAccountId` varchar(100),
	`boardId` varchar(100),
	`extraConfig` json,
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`investimento` decimal(15,2),
	`leads` int,
	`vendas` int,
	`totalEmVendas` decimal(15,2),
	`novosSeguidores` int,
	`rawMetaData` json,
	`rawMondayData` json,
	`s3Key` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `snapshots_id` PRIMARY KEY(`id`)
);

CREATE TABLE `lead_ad_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`phone` varchar(30) NOT NULL,
	`adId` varchar(50),
	`adName` varchar(500),
	`adSetName` varchar(500),
	`campaignId` varchar(50),
	`campaignName` varchar(500),
	`formId` varchar(50),
	`metaLeadId` varchar(50),
	`createdTimeOnMeta` timestamp,
	`capiSent` boolean NOT NULL DEFAULT false,
	`capiSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_ad_matches_id` PRIMARY KEY(`id`),
	CONSTRAINT `lead_ad_matches_metaLeadId_unique` UNIQUE(`metaLeadId`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `metaPixelId` varchar(50);--> statement-breakpoint
ALTER TABLE `clients` ADD `metaCAPIToken` text;
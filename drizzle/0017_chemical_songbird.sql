ALTER TABLE `clients` ADD `isPrePaid` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `logoUrl` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `brandColor` varchar(20);--> statement-breakpoint
ALTER TABLE `sales_records` ADD `groupName` varchar(255);
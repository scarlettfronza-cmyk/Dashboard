ALTER TABLE `integrations` MODIFY COLUMN `provider` enum('meta_ads','monday','google_sheets','sales_sheet','followers_sheet','instagram_oauth') NOT NULL;--> statement-breakpoint
ALTER TABLE `integrations` ADD `metaUserId` varchar(100);--> statement-breakpoint
ALTER TABLE `integrations` ADD `metaIgUserId` varchar(100);--> statement-breakpoint
ALTER TABLE `integrations` ADD `metaIgUsername` varchar(100);
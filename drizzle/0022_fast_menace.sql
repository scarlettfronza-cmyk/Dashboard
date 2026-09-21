ALTER TABLE `clients` ADD `leadChannel` varchar(50);--> statement-breakpoint
ALTER TABLE `clients` ADD `targetCpl` decimal(15,2);--> statement-breakpoint
ALTER TABLE `clients` ADD `targetCostPerConsult` decimal(15,2);--> statement-breakpoint
ALTER TABLE `clients` ADD `targetRoas` decimal(10,2);--> statement-breakpoint
ALTER TABLE `clients` ADD `mappingNotes` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `mappingConfirmed` int DEFAULT 0 NOT NULL;

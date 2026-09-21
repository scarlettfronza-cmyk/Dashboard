CREATE TABLE `capi_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`phone` varchar(30) NOT NULL,
	`eventName` varchar(50) NOT NULL,
	`eventTime` int NOT NULL,
	`value` decimal(15,2),
	`currency` varchar(10) DEFAULT 'BRL',
	`sourceType` varchar(30),
	`sourceId` varchar(100),
	`success` boolean NOT NULL DEFAULT false,
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `capi_events_id` PRIMARY KEY(`id`)
);

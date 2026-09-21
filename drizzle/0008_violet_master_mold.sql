CREATE TABLE `sales_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`patientName` varchar(255),
	`consultDate` timestamp,
	`surgeryValue` decimal(15,2),
	`closed` boolean NOT NULL DEFAULT false,
	`lastUpdated` timestamp,
	`uploadBatch` varchar(64) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_records_id` PRIMARY KEY(`id`)
);

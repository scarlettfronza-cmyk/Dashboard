CREATE TABLE `public_report_access_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`managerId` int,
	`eventType` varchar(40) NOT NULL,
	`tokenFingerprint` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `public_report_access_logs_id` PRIMARY KEY(`id`)
);

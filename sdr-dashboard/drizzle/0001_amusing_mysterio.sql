CREATE TABLE `board_snapshots` (
	`boardId` varchar(32) NOT NULL,
	`boardName` varchar(256),
	`payload` longtext NOT NULL,
	`leadCount` int NOT NULL DEFAULT 0,
	`syncedAt` timestamp,
	`lastAttemptAt` timestamp,
	`lastError` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `board_snapshots_boardId` PRIMARY KEY(`boardId`)
);

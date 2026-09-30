CREATE TABLE IF NOT EXISTS `board_snapshots` (
  `boardId` varchar(32) NOT NULL,
  `boardName` varchar(256) NULL,
  `payload` longtext NOT NULL,
  `leadCount` int NOT NULL DEFAULT 0,
  `syncedAt` timestamp NULL,
  `lastAttemptAt` timestamp NULL,
  `lastError` varchar(512) NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`boardId`)
);

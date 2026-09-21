CREATE TABLE `oauth_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nonceHash` varchar(64) NOT NULL,
	`clientId` int NOT NULL,
	`managerId` int,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oauth_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_states_nonceHash_unique` UNIQUE(`nonceHash`)
);

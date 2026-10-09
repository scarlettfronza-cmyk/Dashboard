CREATE TABLE `decisoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`managerId` int,
	`sinal` text NOT NULL,
	`hipotese` text,
	`acao` text NOT NULL,
	`prazo` varchar(10),
	`resultado` text,
	`concluidaEm` timestamp,
	`noRelatorio` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decisoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `decisoes_clientId_idx` ON `decisoes` (`clientId`);

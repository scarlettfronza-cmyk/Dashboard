-- Migração 0001
-- Executar com o banco em manutenção; a etapa 3 pode apagar dados órfãos.

-- 1. sdrs: um perfil por usuário. Remove a unicidade do e-mail, que colidia
--    quando dois usuários do OAuth compartilhavam endereço.
--    Antes de criar o índice único, elimine perfis duplicados manualmente:
--      SELECT userId, COUNT(*) FROM sdrs GROUP BY userId HAVING COUNT(*) > 1;
ALTER TABLE `sdrs` DROP INDEX `sdrs_email_unique`;
ALTER TABLE `sdrs` MODIFY `userId` int NOT NULL;
ALTER TABLE `sdrs` ADD UNIQUE KEY `sdrs_userId_unique` (`userId`);

-- 2. ai_reports: publicação, período e snapshot de métricas.
ALTER TABLE `ai_reports`
  ADD COLUMN `periodStart` varchar(10) NULL,
  ADD COLUMN `periodEnd` varchar(10) NULL,
  ADD COLUMN `metricsSnapshot` text NULL,
  ADD COLUMN `status` enum('draft','published') NOT NULL DEFAULT 'draft',
  ADD COLUMN `publishedAt` timestamp NULL,
  ADD COLUMN `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 3. Relatórios antigos foram gravados com clientId = 0 por um bug no frontend:
--    nunca apareceram em portal nenhum e não há como saber a que cliente
--    pertencem. Confira antes de apagar.
--      SELECT id, title, period, createdAt FROM ai_reports WHERE clientId = 0;
DELETE FROM `ai_reports` WHERE `clientId` = 0 OR `clientId` IS NULL;
ALTER TABLE `ai_reports` MODIFY `clientId` int NOT NULL;

-- 4. Índices de leitura.
CREATE INDEX `ai_reports_client_status_idx` ON `ai_reports` (`clientId`, `status`);
CREATE INDEX `clients_sdr_idx` ON `clients` (`sdrId`);
CREATE INDEX `chat_messages_sdr_client_idx` ON `chat_messages` (`sdrId`, `clientId`);

-- 5. Login com e-mail e senha.
ALTER TABLE `users`
  ADD COLUMN `passwordHash` varchar(255) NULL;

-- E-mail passa a ser a chave de login. NULLs múltiplos são permitidos em MySQL,
-- então contas antigas do OAuth sem e-mail não colidem. Se houver e-mails
-- duplicados já cadastrados, o índice falha — confira antes:
--   SELECT email, COUNT(*) FROM users WHERE email IS NOT NULL
--   GROUP BY email HAVING COUNT(*) > 1;
ALTER TABLE `users` ADD UNIQUE KEY `users_email_unique` (`email`);

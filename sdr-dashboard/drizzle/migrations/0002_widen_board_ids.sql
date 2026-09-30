-- Migração 0002 — vínculo de vários boards por cliente
--
-- `clients.boardId` guarda um ou mais IDs do Monday separados por vírgula.
-- Cada ID tem ~11 dígitos, então seis boards passam de 70 caracteres e o
-- limite antigo de 64 fazia o insert falhar com "Data too long for column".
-- Sintoma no painel: clicar em "Vincular à SDR" com muitos boards marcados
-- devolvia um erro de query e nada era salvo.

ALTER TABLE `clients` MODIFY `boardId` varchar(512) NOT NULL;

-- migrate_campaign_redesign.sql
-- Execute este arquivo SQL diretamente no banco de dados
-- Comando: mysql -u usuario -p nome_banco < migrate_campaign_redesign.sql

-- Step 1: Adicionar coluna dispatch_interval_seconds à tabela campanhas
ALTER TABLE campanhas 
ADD COLUMN IF NOT EXISTS dispatch_interval_seconds INT DEFAULT 120 
AFTER status;

-- Step 2: Adicionar colunas de status à tabela leads_campanhas (se não existirem)
ALTER TABLE leads_campanhas 
ADD COLUMN IF NOT EXISTS status_email VARCHAR(50) DEFAULT 'pendente' 
AFTER status;

ALTER TABLE leads_campanhas 
ADD COLUMN IF NOT EXISTS status_whatsapp VARCHAR(50) DEFAULT 'pendente' 
AFTER status_email;

-- Step 3: Atualizar campanhas existentes com intervalo padrão
UPDATE campanhas 
SET dispatch_interval_seconds = 120 
WHERE dispatch_interval_seconds IS NULL;

-- Verificar se as colunas foram criadas
SELECT 'Verificando estrutura da tabela campanhas:' AS '';
DESCRIBE campanhas;

SELECT 'Verificando estrutura da tabela leads_campanhas:' AS '';
DESCRIBE leads_campanhas;

SELECT 'Migração concluída com sucesso!' AS '';

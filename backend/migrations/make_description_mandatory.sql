-- Migration to make 'descricao' mandatory in transaction tables

-- 1. Update existing NULL or empty descriptions to a default value
UPDATE entradas SET descricao = 'Sem descrição' WHERE descricao IS NULL OR TRIM(descricao) = '';
UPDATE saidas SET descricao = 'Sem descrição' WHERE descricao IS NULL OR TRIM(descricao) = '';
UPDATE producao_revenda SET descricao = 'Sem descrição' WHERE descricao IS NULL OR TRIM(descricao) = '';

-- 2. Modify columns to be NOT NULL
ALTER TABLE entradas MODIFY COLUMN descricao VARCHAR(255) NOT NULL DEFAULT 'Sem descrição';
ALTER TABLE saidas MODIFY COLUMN descricao VARCHAR(255) NOT NULL DEFAULT 'Sem descrição';
ALTER TABLE producao_revenda MODIFY COLUMN descricao VARCHAR(255) NOT NULL DEFAULT 'Sem descrição';

-- Add active column to support soft delete
USE cash_db;

-- Add active column to tipo_entrada
ALTER TABLE tipo_entrada
ADD COLUMN active BOOLEAN DEFAULT TRUE;

-- Add active column to tipo_despesa
ALTER TABLE tipo_despesa
ADD COLUMN active BOOLEAN DEFAULT TRUE;

-- Add active column to tipo_producao_revenda
ALTER TABLE tipo_producao_revenda
ADD COLUMN active BOOLEAN DEFAULT TRUE;

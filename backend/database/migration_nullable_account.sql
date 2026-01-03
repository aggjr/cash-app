-- Make account_id nullable for all transaction tables

ALTER TABLE entradas MODIFY COLUMN account_id INT NULL;
ALTER TABLE saidas MODIFY COLUMN account_id INT NULL;
ALTER TABLE producao_revenda MODIFY COLUMN account_id INT NULL;
ALTER TABLE aportes MODIFY COLUMN account_id INT NULL;
ALTER TABLE retiradas MODIFY COLUMN account_id INT NULL;

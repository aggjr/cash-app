-- Script para Visualizar o Banco de Dados CASH

-- Selecionar o banco de dados
USE cash_db;

-- Mostrar todas as tabelas
SHOW TABLES;

-- Mostrar estrutura da tabela tipo_entrada
DESCRIBE tipo_entrada;

-- Mostrar todos os dados
SELECT * FROM tipo_entrada;

-- Mostrar dados em formato de árvore
SELECT 
    id,
    label,
    parent_id,
    ordem,
    expanded,
    CASE 
        WHEN parent_id IS NULL THEN 'ROOT'
        ELSE CONCAT('Child of ', parent_id)
    END AS nivel
FROM tipo_entrada
ORDER BY parent_id, ordem;

-- Contar total de registros
SELECT COUNT(*) as total_categorias FROM tipo_entrada;

-- Mostrar apenas categorias raiz
SELECT * FROM tipo_entrada WHERE parent_id IS NULL;

-- Mostrar stored procedures
SHOW PROCEDURE STATUS WHERE Db = 'cash_db';

-- Informações do banco
SELECT 
    table_name,
    table_rows,
    data_length,
    index_length
FROM information_schema.tables
WHERE table_schema = 'cash_db';

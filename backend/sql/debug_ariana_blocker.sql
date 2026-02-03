-- 1. Encontrar o ID do Tipo 'Ariana'
SET @type_id = (SELECT id FROM tipo_entrada WHERE label LIKE '%Ariana%' LIMIT 1);

-- 2. Verificar se encontrou (Result deve ser > 0)
SELECT @type_id as 'ID_Encontrado', label FROM tipo_entrada WHERE id = @type_id;

-- 3. Listar entradas que estão usando este tipo (Bloqueadores)
-- Isso inclui entradas inativas (active=0) que não aparecem na tela, mas prendem a exclusão no banco via Foreign Key
SELECT 
    e.id AS 'ID_Entrada', 
    e.descricao AS 'Descricao', 
    e.valor AS 'Valor', 
    e.data_fato AS 'Data', 
    e.active AS 'Ativo?', 
    e.project_id AS 'ID_Projeto'
FROM entradas e 
WHERE e.tipo_entrada_id = @type_id;

-- 4. Verificar se existem sub-tipos filhos (que também impediriam a exclusão)
SELECT id, label FROM tipo_entrada WHERE parent_id = @type_id;

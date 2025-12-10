-- Add new tables for tipo_despesa and tipo_producao_revenda
USE cash_db;

-- Table: tipo_despesa (Expense Types - Tree Structure)
CREATE TABLE IF NOT EXISTS tipo_despesa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    label VARCHAR(255) NOT NULL,
    parent_id INT NULL,
    ordem INT DEFAULT 0,
    expanded BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_tipo_despesa_parent FOREIGN KEY (parent_id) 
        REFERENCES tipo_despesa(id) 
        ON DELETE CASCADE,
    
    INDEX idx_despesa_parent_id (parent_id),
    INDEX idx_despesa_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: tipo_producao_revenda (Production/Resale Types - Tree Structure)
CREATE TABLE IF NOT EXISTS tipo_producao_revenda (
    id INT PRIMARY KEY AUTO_INCREMENT,
    label VARCHAR(255) NOT NULL,
    parent_id INT NULL,
    ordem INT DEFAULT 0,
    expanded BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_tipo_producao_revenda_parent FOREIGN KEY (parent_id) 
        REFERENCES tipo_producao_revenda(id) 
        ON DELETE CASCADE,
    
    INDEX idx_producao_parent_id (parent_id),
    INDEX idx_producao_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for tipo_despesa
INSERT INTO tipo_despesa (id, label, parent_id, ordem, expanded) VALUES
(1, 'Despesas Operacionais', NULL, 1, TRUE),
(2, 'Pessoal', 1, 1, TRUE),
(3, 'Infraestrutura', 1, 2, TRUE);

-- Insert sample data for tipo_producao_revenda
INSERT INTO tipo_producao_revenda (id, label, parent_id, ordem, expanded) VALUES
(1, 'Produção', NULL, 1, TRUE),
(2, 'Revenda', NULL, 2, TRUE);

-- Stored Procedures for tipo_despesa
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS GetTipoDespesaTree()
BEGIN
    WITH RECURSIVE tree AS (
        SELECT id, label, parent_id, ordem, expanded, 0 AS depth
        FROM tipo_despesa
        WHERE parent_id IS NULL
        UNION ALL
        SELECT t.id, t.label, t.parent_id, t.ordem, t.expanded, tree.depth + 1
        FROM tipo_despesa t
        INNER JOIN tree ON t.parent_id = tree.id
    )
    SELECT * FROM tree ORDER BY depth, ordem;
END //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS MoveTipoDespesa(
    IN node_id INT,
    IN new_parent_id INT,
    IN new_ordem INT
)
BEGIN
    UPDATE tipo_despesa 
    SET parent_id = new_parent_id, ordem = new_ordem
    WHERE id = node_id;
END //
DELIMITER ;

-- Stored Procedures for tipo_producao_revenda
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS GetTipoProducaoRevendaTree()
BEGIN
    WITH RECURSIVE tree AS (
        SELECT id, label, parent_id, ordem, expanded, 0 AS depth
        FROM tipo_producao_revenda
        WHERE parent_id IS NULL
        UNION ALL
        SELECT t.id, t.label, t.parent_id, t.ordem, t.expanded, tree.depth + 1
        FROM tipo_producao_revenda t
        INNER JOIN tree ON t.parent_id = tree.id
    )
    SELECT * FROM tree ORDER BY depth, ordem;
END //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS MoveTipoProducaoRevenda(
    IN node_id INT,
    IN new_parent_id INT,
    IN new_ordem INT
)
BEGIN
    UPDATE tipo_producao_revenda 
    SET parent_id = new_parent_id, ordem = new_ordem
    WHERE id = node_id;
END //
DELIMITER ;

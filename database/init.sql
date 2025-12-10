-- CASH Application Database Schema
-- Complete initialization script

-- Create database
CREATE DATABASE IF NOT EXISTS cash_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cash_db;

-- Table: tipo_entrada (Entry Types - Tree Structure)
CREATE TABLE IF NOT EXISTS tipo_entrada (
    id INT PRIMARY KEY AUTO_INCREMENT,
    label VARCHAR(255) NOT NULL,
    parent_id INT NULL,
    ordem INT DEFAULT 0,
    expanded BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_tipo_entrada_parent FOREIGN KEY (parent_id) 
        REFERENCES tipo_entrada(id) 
        ON DELETE CASCADE,
    
    INDEX idx_parent_id (parent_id),
    INDEX idx_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data
INSERT INTO tipo_entrada (id, label, parent_id, ordem, expanded) VALUES
(1, 'Receita Operacional', NULL, 1, TRUE),
(2, 'STOCKSPIN', 1, 1, TRUE),
(3, 'TELECOM', 1, 2, TRUE),
(4, 'SARON', 2, 1, TRUE),
(5, 'CIMCOP', 3, 1, TRUE);

-- Stored Procedure: Get full tree
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS GetTipoEntradaTree()
BEGIN
    WITH RECURSIVE tree AS (
        SELECT id, label, parent_id, ordem, expanded, 0 AS depth
        FROM tipo_entrada
        WHERE parent_id IS NULL
        UNION ALL
        SELECT t.id, t.label, t.parent_id, t.ordem, t.expanded, tree.depth + 1
        FROM tipo_entrada t
        INNER JOIN tree ON t.parent_id = tree.id
    )
    SELECT * FROM tree ORDER BY depth, ordem;
END //
DELIMITER ;

-- Stored Procedure: Move node
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS MoveTipoEntrada(
    IN node_id INT,
    IN new_parent_id INT,
    IN new_ordem INT
)
BEGIN
    UPDATE tipo_entrada 
    SET parent_id = new_parent_id, ordem = new_ordem
    WHERE id = node_id;
END //
DELIMITER ;

-- Stored Procedure: Get children
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS GetChildren(IN parent_node_id INT)
BEGIN
    SELECT * FROM tipo_entrada 
    WHERE parent_id = parent_node_id 
    ORDER BY ordem;
END //
DELIMITER ;

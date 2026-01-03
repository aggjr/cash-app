-- Database Schema for CASH Application
-- Tree structure for Tipo Entrada (Entry Types)

-- Create database (if needed)
-- CREATE DATABASE cash_db;
-- USE cash_db;

-- Table: tipo_entrada
-- Stores hierarchical entry types using the adjacency list pattern
CREATE TABLE tipo_entrada (
    id INT PRIMARY KEY AUTO_INCREMENT,
    label VARCHAR(255) NOT NULL,
    parent_id INT NULL,
    ordem INT DEFAULT 0,
    expanded BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key to self for parent-child relationship
    CONSTRAINT fk_parent FOREIGN KEY (parent_id) 
        REFERENCES tipo_entrada(id) 
        ON DELETE CASCADE,
    
    -- Index for faster queries
    INDEX idx_parent_id (parent_id),
    INDEX idx_ordem (ordem)
);

-- Sample data based on your tree structure
INSERT INTO tipo_entrada (id, label, parent_id, ordem, expanded) VALUES
-- Root level
(1, 'Receita Operacional', NULL, 1, TRUE),

-- Level 1 - Children of Receita Operacional
(2, 'STOCKSPIN', 1, 1, TRUE),
(3, 'TELECOM', 1, 2, TRUE),

-- Level 2 - Children of STOCKSPIN
(4, 'SARON', 2, 1, TRUE),

-- Level 2 - Children of TELECOM
(5, 'CIMCOP', 3, 1, TRUE);

-- Query examples:

-- 1. Get all root nodes (no parent)
-- SELECT * FROM tipo_entrada WHERE parent_id IS NULL ORDER BY ordem;

-- 2. Get all children of a specific node
-- SELECT * FROM tipo_entrada WHERE parent_id = 1 ORDER BY ordem;

-- 3. Get full tree with depth (using recursive CTE)
-- WITH RECURSIVE tree AS (
--     SELECT id, label, parent_id, ordem, 0 AS depth
--     FROM tipo_entrada
--     WHERE parent_id IS NULL
--     UNION ALL
--     SELECT t.id, t.label, t.parent_id, t.ordem, tree.depth + 1
--     FROM tipo_entrada t
--     INNER JOIN tree ON t.parent_id = tree.id
-- )
-- SELECT * FROM tree ORDER BY depth, ordem;

-- 4. Get path from root to specific node
-- WITH RECURSIVE path AS (
--     SELECT id, label, parent_id, CAST(label AS CHAR(1000)) AS path
--     FROM tipo_entrada
--     WHERE id = 5  -- CIMCOP
--     UNION ALL
--     SELECT t.id, t.label, t.parent_id, CONCAT(t.label, ' > ', path.path)
--     FROM tipo_entrada t
--     INNER JOIN path ON path.parent_id = t.id
-- )
-- SELECT path FROM path WHERE parent_id IS NULL;

-- 5. Move a node (change parent)
-- UPDATE tipo_entrada SET parent_id = 2 WHERE id = 5;

-- 6. Delete a node and all its descendants (CASCADE handles this)
-- DELETE FROM tipo_entrada WHERE id = 2;

-- 7. Reorder siblings
-- UPDATE tipo_entrada SET ordem = 1 WHERE id = 3;
-- UPDATE tipo_entrada SET ordem = 2 WHERE id = 2;

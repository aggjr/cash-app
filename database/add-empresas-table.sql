-- Migration: Create empresas table and update contas table
-- Date: 2025-12-05

USE cash_db;

-- Create empresas (companies) table
CREATE TABLE IF NOT EXISTS empresas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    project_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_id (project_id),
    INDEX idx_cnpj (cnpj),
    INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add company_id to contas table
ALTER TABLE contas 
ADD COLUMN IF NOT EXISTS company_id INT NULL AFTER project_id;

-- Add foreign key constraint
ALTER TABLE contas
ADD CONSTRAINT fk_contas_company 
    FOREIGN KEY (company_id) REFERENCES empresas(id) 
    ON DELETE RESTRICT;

-- Add index for better query performance
ALTER TABLE contas
ADD INDEX IF NOT EXISTS idx_company_id (company_id);

-- Insert sample company for testing
INSERT INTO empresas (name, cnpj, description, project_id) VALUES
('Gestão de Foco', '18.079.490/0001-05', 'Empresa principal do grupo', 1)
ON DUPLICATE KEY UPDATE name = name;

-- Update existing accounts to link to the sample company (optional)
UPDATE contas 
SET company_id = (SELECT id FROM empresas WHERE cnpj = '18.079.490/0001-05' LIMIT 1)
WHERE company_id IS NULL AND project_id = 1;

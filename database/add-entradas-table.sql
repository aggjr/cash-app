-- Create entradas (income transactions) table
-- This table stores all income transactions with dates, amounts, and relationships

CREATE TABLE IF NOT EXISTS entradas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Date fields
    data_fato DATE NOT NULL COMMENT 'Date when the income event occurred',
    data_prevista_pagamento DATE NOT NULL COMMENT 'Expected payment date',
    data_real_pagamento DATE NULL COMMENT 'Actual payment date (null if not yet received)',
    
    -- Amount and description
    valor DECIMAL(15, 2) NOT NULL COMMENT 'Income amount',
    descricao TEXT NULL COMMENT 'Optional description',
    
    -- Foreign keys
    tipo_entrada_id INT NOT NULL COMMENT 'Reference to income type',
    company_id INT NOT NULL COMMENT 'Reference to company',
    account_id INT NOT NULL COMMENT 'Reference to account where money will be received',
    project_id INT NOT NULL COMMENT 'Reference to project',
    
    -- Status and timestamps
    active BOOLEAN DEFAULT TRUE COMMENT 'Soft delete flag',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_entradas_tipo_entrada 
        FOREIGN KEY (tipo_entrada_id) REFERENCES tipo_entrada(id)
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_entradas_company 
        FOREIGN KEY (company_id) REFERENCES empresas(id)
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_entradas_account 
        FOREIGN KEY (account_id) REFERENCES contas(id)
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_entradas_project 
        FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE,
    
    -- Indexes for better query performance
    INDEX idx_entradas_data_fato (data_fato),
    INDEX idx_entradas_data_prevista (data_prevista_pagamento),
    INDEX idx_entradas_data_real (data_real_pagamento),
    INDEX idx_entradas_tipo (tipo_entrada_id),
    INDEX idx_entradas_company (company_id),
    INDEX idx_entradas_account (account_id),
    INDEX idx_entradas_project (project_id),
    INDEX idx_entradas_active (active)
);

-- Add some sample data for testing (optional)
-- INSERT INTO entradas (data_fato, data_prevista_pagamento, valor, descricao, tipo_entrada_id, company_id, account_id, project_id)
-- VALUES ('2025-12-01', '2025-12-15', 5000.00, 'Venda de produto', 1, 1, 1, 1);

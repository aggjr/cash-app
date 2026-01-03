-- Create tipo_producao_revenda table (mirroring tipo_despesa)
CREATE TABLE IF NOT EXISTS tipo_producao_revenda (
    id INT PRIMARY KEY AUTO_INCREMENT,
    label VARCHAR(255) NOT NULL,
    parent_id INT NULL,
    CONSTRAINT fk_tipo_producao_parent
        FOREIGN KEY (parent_id) REFERENCES tipo_producao_revenda(id)
        ON DELETE RESTRICT
);

-- Create producao_revenda (mirroring despesas)
CREATE TABLE IF NOT EXISTS producao_revenda (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Date fields
    data_fato DATE NOT NULL COMMENT 'Date when the event occurred',
    data_prevista_pagamento DATE NOT NULL COMMENT 'Expected payment date',
    data_real_pagamento DATE NULL COMMENT 'Actual payment date (null if not yet paid)',
    
    -- Amount and description
    valor DECIMAL(15, 2) NOT NULL COMMENT 'Amount',
    descricao TEXT NULL COMMENT 'Optional description',
    
    -- Foreign keys
    tipo_producao_revenda_id INT NOT NULL COMMENT 'Reference to category',
    company_id INT NOT NULL COMMENT 'Reference to company',
    account_id INT NOT NULL COMMENT 'Reference to account',
    project_id INT NOT NULL COMMENT 'Reference to project',
    
    -- Status and timestamps
    active BOOLEAN DEFAULT TRUE COMMENT 'Soft delete flag',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_producao_tipo 
        FOREIGN KEY (tipo_producao_revenda_id) REFERENCES tipo_producao_revenda(id)
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_producao_company 
        FOREIGN KEY (company_id) REFERENCES empresas(id)
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_producao_account 
        FOREIGN KEY (account_id) REFERENCES contas(id)
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_producao_project 
        FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_producao_data_fato (data_fato),
    INDEX idx_producao_project (project_id),
    INDEX idx_producao_active (active)
);

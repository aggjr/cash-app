-- Create tables for internal movements: Aportes (Injections) and Retiradas (Withdrawals)

USE cash_db;

-- Aportes (Inflows)
CREATE TABLE IF NOT EXISTS aportes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    data_fato DATE NOT NULL,
    data_real DATE NULL,
    valor DECIMAL(15, 2) NOT NULL,
    descricao TEXT NULL,
    
    company_id INT NOT NULL,
    account_id INT NOT NULL,
    project_id INT NOT NULL,
    
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_aportes_company FOREIGN KEY (company_id) REFERENCES empresas(id),
    CONSTRAINT fk_aportes_account FOREIGN KEY (account_id) REFERENCES contas(id),
    CONSTRAINT fk_aportes_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    INDEX idx_aportes_data_real (data_real),
    INDEX idx_aportes_project (project_id)
);

-- Retiradas (Outflows)
CREATE TABLE IF NOT EXISTS retiradas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    data_fato DATE NOT NULL,
    data_real DATE NULL,
    valor DECIMAL(15, 2) NOT NULL,
    descricao TEXT NULL,
    
    company_id INT NOT NULL,
    account_id INT NOT NULL,
    project_id INT NOT NULL,
    
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_retiradas_company FOREIGN KEY (company_id) REFERENCES empresas(id),
    CONSTRAINT fk_retiradas_account FOREIGN KEY (account_id) REFERENCES contas(id),
    CONSTRAINT fk_retiradas_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    INDEX idx_retiradas_data_real (data_real),
    INDEX idx_retiradas_project (project_id)
);

-- Ensure SALDO INICIAL type exists in tipo_entrada
-- Using a procedure to handle 'IF NOT EXISTS' logic for INSERT
DELIMITER //
CREATE PROCEDURE EnsureSaldoInicial()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM tipo_entrada WHERE label = 'SALDO INICIAL') THEN
        INSERT INTO tipo_entrada (label, parent_id, ordem, expanded) 
        VALUES ('SALDO INICIAL', NULL, 0, TRUE);
    END IF;
END //
DELIMITER ;

CALL EnsureSaldoInicial();
DROP PROCEDURE EnsureSaldoInicial;

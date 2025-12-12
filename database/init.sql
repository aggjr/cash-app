-- INIT.SQL - Full Database Reset & Setup for CASH System
-- --------------------------------------------------------
-- WARNING: This script drops ALL existing tables and data.
-- --------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop Tables (Order: Child -> Parent)
DROP TABLE IF EXISTS transferencias;
DROP TABLE IF EXISTS retiradas;
DROP TABLE IF EXISTS aportes;
DROP TABLE IF EXISTS producao_revenda;
DROP TABLE IF EXISTS saidas;
DROP TABLE IF EXISTS entradas;
DROP TABLE IF EXISTS contas;
DROP TABLE IF EXISTS empresas;
DROP TABLE IF EXISTS tipo_producao_revenda;
DROP TABLE IF EXISTS tipo_saida;
DROP TABLE IF EXISTS tipo_entrada;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS projects;

SET FOREIGN_KEY_CHECKS = 1;

-- 2. Create Projects & Users (Auth Base)
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    project_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- 3. Core Entities
CREATE TABLE empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    project_id INT NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE contas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255),
    account_number VARCHAR(50),
    company_id INT,
    project_id INT NOT NULL,
    current_balance DECIMAL(15,2) DEFAULT 0.00,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES empresas(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 4. Type Hierarchies
CREATE TABLE tipo_entrada (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    parent_id INT,
    ordem INT DEFAULT 0,
    expanded TINYINT(1) DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    project_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES tipo_entrada(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE tipo_saida (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    parent_id INT,
    ordem INT DEFAULT 0,
    expanded TINYINT(1) DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    project_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES tipo_saida(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE tipo_producao_revenda (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    parent_id INT,
    ordem INT DEFAULT 0,
    expanded TINYINT(1) DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    project_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES tipo_producao_revenda(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 5. Transactions

CREATE TABLE entradas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255),
    valor DECIMAL(15,2) NOT NULL,
    data_fato DATE,
    data_prevista_recebimento DATE,
    data_real_recebimento DATE,
    tipo_entrada_id INT NOT NULL,
    account_id INT NOT NULL,
    company_id INT,
    project_id INT NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tipo_entrada_id) REFERENCES tipo_entrada(id),
    FOREIGN KEY (account_id) REFERENCES contas(id),
    FOREIGN KEY (company_id) REFERENCES empresas(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE saidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255),
    valor DECIMAL(15,2) NOT NULL,
    data_fato DATE,
    data_prevista_pagamento DATE,
    data_real_pagamento DATE,
    tipo_saida_id INT NOT NULL,
    account_id INT NOT NULL,
    company_id INT,
    project_id INT NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tipo_saida_id) REFERENCES tipo_saida(id),
    FOREIGN KEY (account_id) REFERENCES contas(id),
    FOREIGN KEY (company_id) REFERENCES empresas(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE producao_revenda (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255),
    valor DECIMAL(15,2) NOT NULL,
    data_fato DATE,
    data_prevista_pagamento DATE,
    data_real_pagamento DATE,
    tipo_id INT NOT NULL,
    account_id INT NOT NULL,
    company_id INT,
    project_id INT NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tipo_id) REFERENCES tipo_producao_revenda(id),
    FOREIGN KEY (account_id) REFERENCES contas(id),
    FOREIGN KEY (company_id) REFERENCES empresas(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE aportes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255),
    valor DECIMAL(15,2) NOT NULL,
    data_fato DATE,
    data_real DATE,
    account_id INT NOT NULL,
    company_id INT,
    project_id INT NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES contas(id),
    FOREIGN KEY (company_id) REFERENCES empresas(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE retiradas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255),
    valor DECIMAL(15,2) NOT NULL,
    data_fato DATE,
    data_prevista DATE,
    data_real DATE,
    account_id INT NOT NULL,
    company_id INT,
    project_id INT NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES contas(id),
    FOREIGN KEY (company_id) REFERENCES empresas(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE transferencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao TEXT,
    valor DECIMAL(15,2) NOT NULL,
    data_fato DATE,
    data_prevista DATE,
    data_real DATE,
    source_account_id INT NOT NULL,
    destination_account_id INT NOT NULL,
    project_id INT NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (source_account_id) REFERENCES contas(id),
    FOREIGN KEY (destination_account_id) REFERENCES contas(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Seed Minimal Data (Optional, ensuring at least one project exists if strictly required)
-- Removed seed project to avoid ID conflicts


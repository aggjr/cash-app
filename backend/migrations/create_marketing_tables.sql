-- Script SQL para criar tabelas do módulo Marketing
-- Execute este script diretamente no MySQL/phpMyAdmin

USE cash_db;

-- 1. Tabela de Características
CREATE TABLE IF NOT EXISTS caracteristicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabela de Grupos de Leads
CREATE TABLE IF NOT EXISTS grupos_leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabela de Composição de Grupos (hierarquia)
CREATE TABLE IF NOT EXISTS grupos_composicao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_pai_id INT NOT NULL,
  grupo_filho_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grupo_pai_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_filho_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
  UNIQUE KEY unique_composicao (grupo_pai_id, grupo_filho_id),
  CHECK (grupo_pai_id != grupo_filho_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabela de Relacionamento Grupos-Características
CREATE TABLE IF NOT EXISTS grupos_caracteristicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT NOT NULL,
  caracteristica_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grupo_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
  FOREIGN KEY (caracteristica_id) REFERENCES caracteristicas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_grupo_caracteristica (grupo_id, caracteristica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabela de Leads
CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  telefone VARCHAR(20),
  grupo_id INT,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (grupo_id) REFERENCES grupos_leads(id) ON DELETE SET NULL,
  INDEX idx_grupo (grupo_id),
  INDEX idx_email (email),
  INDEX idx_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabela de Campanhas
CREATE TABLE IF NOT EXISTS campanhas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  data_inicio DATE,
  data_fim DATE,
  status ENUM('planejamento', 'ativa', 'pausada', 'concluida', 'cancelada') DEFAULT 'planejamento',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_datas (data_inicio, data_fim)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabela de Relacionamento Leads-Campanhas
CREATE TABLE IF NOT EXISTS leads_campanhas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL,
  campanha_id INT NOT NULL,
  data_associacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pendente', 'contatado', 'respondeu', 'converteu', 'rejeitou') DEFAULT 'pendente',
  observacoes TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_lead_campanha (lead_id, campanha_id),
  INDEX idx_campanha (campanha_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabela de Relacionamento Grupos-Campanhas
CREATE TABLE IF NOT EXISTS grupos_campanhas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT NOT NULL,
  campanha_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grupo_id) REFERENCES grupos_leads(id) ON DELETE CASCADE,
  FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE CASCADE,
  UNIQUE KEY unique_grupo_campanha (grupo_id, campanha_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificar tabelas criadas
SHOW TABLES LIKE '%marketing%';
SHOW TABLES LIKE 'caracteristicas';
SHOW TABLES LIKE 'grupos_leads';
SHOW TABLES LIKE 'leads';
SHOW TABLES LIKE 'campanhas';

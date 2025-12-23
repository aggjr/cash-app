-- ============================================
-- PRODUCTION Database Schema Backup
-- ============================================
-- Generated: 2025-12-23 09:35:00
-- Database: cash
-- Environment: Production (Easypanel)
-- Baseline: v1.0.0-export-features
-- Total Tables: 15
-- ============================================

SET FOREIGN_KEY_CHECKS=0;

-- ============================================
-- Table: aportes
-- ============================================
DROP TABLE IF EXISTS `aportes`;
CREATE TABLE `aportes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_real` date DEFAULT NULL,
  `account_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `data_prevista` date DEFAULT NULL,
  `comprovante_url` varchar(255) DEFAULT NULL,
  `forma_pagamento` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `aportes_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `aportes_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `aportes_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: contas
-- ============================================
DROP TABLE IF EXISTS `contas`;
CREATE TABLE `contas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `bank_name` varchar(255) DEFAULT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `current_balance` decimal(15,2) DEFAULT '0.00',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `account_type` varchar(50) DEFAULT 'outros',
  `initial_balance` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `contas_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `contas_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: empresas
-- ============================================
DROP TABLE IF EXISTS `empresas`;
CREATE TABLE `empresas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `cnpj` varchar(20) DEFAULT NULL,
  `description` text,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `empresas_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: entradas
-- ============================================
DROP TABLE IF EXISTS `entradas`;
CREATE TABLE `entradas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista_recebimento` date DEFAULT NULL,
  `data_real_recebimento` date DEFAULT NULL,
  `tipo_entrada_id` int NOT NULL,
  `account_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `data_atraso` date DEFAULT NULL,
  `comprovante_url` varchar(255) DEFAULT NULL,
  `forma_pagamento` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tipo_entrada_id` (`tipo_entrada_id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `entradas_ibfk_1` FOREIGN KEY (`tipo_entrada_id`) REFERENCES `tipo_entrada` (`id`),
  CONSTRAINT `entradas_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `entradas_ibfk_3` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `entradas_ibfk_4` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: error_catalog
-- ============================================
DROP TABLE IF EXISTS `error_catalog`;
CREATE TABLE `error_catalog` (
  `code` varchar(20) NOT NULL,
  `http_status` int NOT NULL,
  `message` text NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: producao_revenda
-- ============================================
DROP TABLE IF EXISTS `producao_revenda`;
CREATE TABLE `producao_revenda` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista_pagamento` date DEFAULT NULL,
  `data_prevista_atraso` date DEFAULT NULL,
  `data_real_pagamento` date DEFAULT NULL,
  `tipo_id` int NOT NULL,
  `account_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `forma_pagamento` varchar(50) DEFAULT NULL,
  `comprovante_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tipo_id` (`tipo_id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `producao_revenda_ibfk_1` FOREIGN KEY (`tipo_id`) REFERENCES `tipo_producao_revenda` (`id`),
  CONSTRAINT `producao_revenda_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `producao_revenda_ibfk_3` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `producao_revenda_ibfk_4` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: project_users
-- ============================================
DROP TABLE IF EXISTS `project_users`;
CREATE TABLE `project_users` (
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `password` varchar(255) NOT NULL,
  `password_reset_required` tinyint(1) DEFAULT '0',
  `role` enum('master','user') DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `invited_by` int DEFAULT NULL,
  `invited_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `joined_at` timestamp NULL DEFAULT NULL,
  `status` enum('pending','active','inactive') DEFAULT 'active',
  `last_login_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`project_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `project_users_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_users_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: projects
-- ============================================
DROP TABLE IF EXISTS `projects`;
CREATE TABLE `projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: retiradas
-- ============================================
DROP TABLE IF EXISTS `retiradas`;
CREATE TABLE `retiradas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista` date DEFAULT NULL,
  `data_real` date DEFAULT NULL,
  `account_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `comprovante_url` varchar(255) DEFAULT NULL,
  `forma_pagamento` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `retiradas_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `retiradas_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `retiradas_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: saidas
-- ============================================
DROP TABLE IF EXISTS `saidas`;
CREATE TABLE `saidas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista_pagamento` date DEFAULT NULL,
  `data_prevista_atraso` date DEFAULT NULL,
  `data_real_pagamento` date DEFAULT NULL,
  `tipo_saida_id` int NOT NULL,
  `account_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `data_atraso` date DEFAULT NULL,
  `comprovante_url` varchar(255) DEFAULT NULL,
  `forma_pagamento` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tipo_saida_id` (`tipo_saida_id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `saidas_ibfk_1` FOREIGN KEY (`tipo_saida_id`) REFERENCES `tipo_saida` (`id`),
  CONSTRAINT `saidas_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `saidas_ibfk_3` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `saidas_ibfk_4` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: tipo_entrada
-- ============================================
DROP TABLE IF EXISTS `tipo_entrada`;
CREATE TABLE `tipo_entrada` (
  `id` int NOT NULL AUTO_INCREMENT,
  `label` varchar(255) NOT NULL,
  `parent_id` int DEFAULT NULL,
  `ordem` int DEFAULT '0',
  `expanded` tinyint(1) DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `project_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `parent_id` (`parent_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `tipo_entrada_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `tipo_entrada` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tipo_entrada_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: tipo_producao_revenda
-- ============================================
DROP TABLE IF EXISTS `tipo_producao_revenda`;
CREATE TABLE `tipo_producao_revenda` (
  `id` int NOT NULL AUTO_INCREMENT,
  `label` varchar(255) NOT NULL,
  `parent_id` int DEFAULT NULL,
  `ordem` int DEFAULT '0',
  `expanded` tinyint(1) DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `project_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `parent_id` (`parent_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `tipo_producao_revenda_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `tipo_producao_revenda` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tipo_producao_revenda_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: tipo_saida
-- ============================================
DROP TABLE IF EXISTS `tipo_saida`;
CREATE TABLE `tipo_saida` (
  `id` int NOT NULL AUTO_INCREMENT,
  `label` varchar(255) NOT NULL,
  `parent_id` int DEFAULT NULL,
  `ordem` int DEFAULT '0',
  `expanded` tinyint(1) DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `project_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `parent_id` (`parent_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `tipo_saida_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `tipo_saida` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tipo_saida_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: transferencias
-- ============================================
DROP TABLE IF EXISTS `transferencias`;
CREATE TABLE `transferencias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` text,
  `comprovante_url` varchar(500) DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista` date DEFAULT NULL,
  `data_real` date DEFAULT NULL,
  `source_account_id` int DEFAULT NULL,
  `destination_account_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `forma_pagamento` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `source_account_id` (`source_account_id`),
  KEY `destination_account_id` (`destination_account_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `transferencias_ibfk_1` FOREIGN KEY (`source_account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `transferencias_ibfk_2` FOREIGN KEY (`destination_account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `transferencias_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table: users
-- ============================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS=1;

-- ============================================
-- End of Production Schema Backup
-- ============================================

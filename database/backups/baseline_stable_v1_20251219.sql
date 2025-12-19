-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: cash_db
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `aportes`
--

DROP TABLE IF EXISTS `aportes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `aportes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comprovante_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista` date DEFAULT NULL,
  `data_real` date DEFAULT NULL,
  `account_id` int NOT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `aportes_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `aportes_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `aportes_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `aportes`
--

LOCK TABLES `aportes` WRITE;
/*!40000 ALTER TABLE `aportes` DISABLE KEYS */;
INSERT INTO `aportes` VALUES (1,'',NULL,100000.00,'2025-12-15',NULL,'2025-12-15',1,1,4,1,'2025-12-15 14:48:52'),(2,'',NULL,100.00,'2025-12-16','2025-12-16','2025-12-16',2,1,4,1,'2025-12-16 16:42:57');
/*!40000 ALTER TABLE `aportes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `centros_custo`
--

DROP TABLE IF EXISTS `centros_custo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `centros_custo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `centros_custo`
--

LOCK TABLES `centros_custo` WRITE;
/*!40000 ALTER TABLE `centros_custo` DISABLE KEYS */;
INSERT INTO `centros_custo` VALUES (2,4,'teste','',1,'2025-12-15 17:28:15','2025-12-15 17:28:21'),(3,5,'Matriz','asdf',1,'2025-12-15 19:12:03','2025-12-15 19:12:03'),(4,5,'Adm','asdf',1,'2025-12-15 19:12:10','2025-12-15 19:12:10');
/*!40000 ALTER TABLE `centros_custo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contas`
--

DROP TABLE IF EXISTS `contas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `account_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'outros',
  `initial_balance` decimal(15,2) DEFAULT '0.00',
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `current_balance` decimal(15,2) DEFAULT '0.00',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `contas_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `contas_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contas`
--

LOCK TABLES `contas` WRITE;
/*!40000 ALTER TABLE `contas` DISABLE KEYS */;
INSERT INTO `contas` VALUES (1,'BB','efsdxc','outros',0.00,NULL,NULL,1,4,76190.00,1,'2025-12-15 13:29:01'),(2,'caixa dineiro','rafdsx','outros',0.00,NULL,NULL,1,4,1200.00,1,'2025-12-15 13:29:09'),(3,'bb','sefv','outros',0.00,NULL,NULL,2,5,0.00,1,'2025-12-15 19:09:56'),(4,'cofre','','outros',0.00,NULL,NULL,2,5,0.00,1,'2025-12-15 19:10:06');
/*!40000 ALTER TABLE `contas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `empresas`
--

DROP TABLE IF EXISTS `empresas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `empresas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cnpj` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `empresas_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `empresas`
--

LOCK TABLES `empresas` WRITE;
/*!40000 ALTER TABLE `empresas` DISABLE KEYS */;
INSERT INTO `empresas` VALUES (1,'Foccus Gestao','32.453.241/4524-43','adscx',4,1,'2025-12-15 13:24:36'),(2,'afds','11.111.111/1111-11','fgsdv',5,1,'2025-12-15 19:09:43');
/*!40000 ALTER TABLE `empresas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entradas`
--

DROP TABLE IF EXISTS `entradas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entradas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comprovante_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista_recebimento` date DEFAULT NULL,
  `data_atraso` date DEFAULT NULL,
  `data_prevista_atraso` date DEFAULT NULL,
  `data_real_recebimento` date DEFAULT NULL,
  `tipo_entrada_id` int NOT NULL,
  `account_id` int NOT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `centro_custo_id` int DEFAULT NULL,
  `forma_pagamento` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tipo_entrada_id` (`tipo_entrada_id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  KEY `fk_entradas_centro_custo` (`centro_custo_id`),
  CONSTRAINT `entradas_ibfk_1` FOREIGN KEY (`tipo_entrada_id`) REFERENCES `tipo_entrada` (`id`),
  CONSTRAINT `entradas_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `entradas_ibfk_3` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `entradas_ibfk_4` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`),
  CONSTRAINT `fk_entradas_centro_custo` FOREIGN KEY (`centro_custo_id`) REFERENCES `centros_custo` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entradas`
--

LOCK TABLES `entradas` WRITE;
/*!40000 ALTER TABLE `entradas` DISABLE KEYS */;
INSERT INTO `entradas` VALUES (1,'',NULL,90.00,'2025-12-12','2025-12-12',NULL,NULL,'2025-12-12',2,1,1,4,1,'2025-12-15 14:37:08',NULL,NULL),(2,'',NULL,1000.00,'2025-12-15','2025-12-15',NULL,NULL,'2025-12-15',2,1,1,4,1,'2025-12-15 22:02:31',NULL,NULL),(3,'','/uploads/receipts/1765847650848-606275134.pdf',450.00,'2025-12-15','2025-12-15',NULL,'2025-12-15','2025-12-15',2,1,1,4,1,'2025-12-16 01:14:10',NULL,NULL),(4,'','/uploads/1766075558977-erd_financeiro.pdf',100.00,'2025-12-18','2025-12-18',NULL,NULL,'2025-12-18',2,1,1,4,1,'2025-12-18 16:33:07',NULL,NULL);
/*!40000 ALTER TABLE `entradas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `error_catalog`
--

DROP TABLE IF EXISTS `error_catalog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `error_catalog` (
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `http_status` int NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `error_catalog`
--

LOCK TABLES `error_catalog` WRITE;
/*!40000 ALTER TABLE `error_catalog` DISABLE KEYS */;
INSERT INTO `error_catalog` VALUES ('AUTH-001',401,'Acesso negado. Token não fornecido.','Missing token','2025-12-07 21:05:21','2025-12-07 21:05:21'),('AUTH-002',401,'Token inválido ou expirado.','Invalid token','2025-12-07 21:05:21','2025-12-07 21:05:21'),('AUTH-003',400,'Credenciais inválidas.','Login failed','2025-12-07 21:05:21','2025-12-07 21:05:21'),('AUTH-004',403,'Você não tem permissão para realizar esta ação.','Forbidden','2025-12-07 21:05:21','2025-12-07 21:05:21'),('DB-001',500,'Erro de conexão com o banco de dados.','Database connection error','2025-12-07 21:05:21','2025-12-07 21:05:21'),('RES-001',404,'Recurso não encontrado.','Not found','2025-12-07 21:05:21','2025-12-07 21:05:21'),('RES-002',409,'Este registro já existe.','Duplicate entry','2025-12-07 21:05:21','2025-12-07 21:05:21'),('RES-003',400,'Não é possível excluir este registro pois existem dependências.','Constraint violation','2025-12-07 21:05:21','2025-12-07 21:05:21'),('SYS-001',500,'Erro interno do servidor.','Internal server error','2025-12-07 21:05:21','2025-12-07 21:05:21'),('VAL-001',400,'Dados inválidos.','Generic validation error','2025-12-07 21:05:21','2025-12-07 21:05:21'),('VAL-002',400,'Campos obrigatórios ausentes.','Missing required fields','2025-12-07 21:05:21','2025-12-07 21:05:21'),('VAL-003',400,'Formato de e-mail inválido.','Invalid email','2025-12-07 21:05:21','2025-12-07 21:05:21'),('VAL-004',400,'A senha deve ter no mínimo 8 caracteres.','Password too short','2025-12-07 21:05:21','2025-12-07 21:05:21'),('VAL-005',400,'CNPJ inválido.','Invalid CNPJ','2025-12-07 21:05:21','2025-12-07 21:05:21');
/*!40000 ALTER TABLE `error_catalog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `producao_revenda`
--

DROP TABLE IF EXISTS `producao_revenda`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `producao_revenda` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comprovante_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista_pagamento` date DEFAULT NULL,
  `data_prevista_atraso` date DEFAULT NULL,
  `data_real_pagamento` date DEFAULT NULL,
  `tipo_id` int NOT NULL,
  `account_id` int DEFAULT NULL COMMENT 'Reference to account (Matches contas.id)',
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `centro_custo_id` int DEFAULT NULL COMMENT 'Reference to cost center',
  `forma_pagamento` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tipo_id` (`tipo_id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  KEY `fk_producao_revenda_centro_custo` (`centro_custo_id`),
  CONSTRAINT `fk_producao_revenda_centro_custo` FOREIGN KEY (`centro_custo_id`) REFERENCES `centros_custo` (`id`),
  CONSTRAINT `producao_revenda_ibfk_1` FOREIGN KEY (`tipo_id`) REFERENCES `tipo_producao_revenda` (`id`),
  CONSTRAINT `producao_revenda_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `producao_revenda_ibfk_3` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `producao_revenda_ibfk_4` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `producao_revenda`
--

LOCK TABLES `producao_revenda` WRITE;
/*!40000 ALTER TABLE `producao_revenda` DISABLE KEYS */;
INSERT INTO `producao_revenda` VALUES (1,'',NULL,1000.00,'2025-12-15','2025-12-19',NULL,NULL,2,NULL,1,4,1,'2025-12-15 16:07:34',NULL,NULL),(3,'','/uploads/receipts/1765900561916-504463863.pdf',200.00,'2025-12-16','2025-12-19',NULL,NULL,2,NULL,1,4,1,'2025-12-16 15:56:01',NULL,NULL);
/*!40000 ALTER TABLE `producao_revenda` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_users`
--

DROP TABLE IF EXISTS `project_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_users` (
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_reset_required` tinyint(1) DEFAULT '1',
  `role` enum('master','user') COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `invited_by` int DEFAULT NULL,
  `invited_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `joined_at` timestamp NULL DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `status` enum('pending','active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  PRIMARY KEY (`project_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `project_users_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_users_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_users`
--

LOCK TABLES `project_users` WRITE;
/*!40000 ALTER TABLE `project_users` DISABLE KEYS */;
INSERT INTO `project_users` VALUES (1,1,'$2b$10$wa6k2YqOZfIh0nly1kJC4u3VGb.MWockrh6lwHSgC4XTRFvpIxFmq',0,'master','2025-11-29 12:45:49',NULL,'2025-12-06 18:07:26',NULL,'2025-12-08 17:45:20','active'),(2,1,'$2b$10$wa6k2YqOZfIh0nly1kJC4u3VGb.MWockrh6lwHSgC4XTRFvpIxFmq',0,'master','2025-12-01 12:19:39',NULL,'2025-12-06 18:07:26',NULL,'2025-12-08 17:45:20','active'),(3,1,'$2b$10$wa6k2YqOZfIh0nly1kJC4u3VGb.MWockrh6lwHSgC4XTRFvpIxFmq',0,'user','2025-12-06 19:16:28',2,'2025-12-06 19:16:28','2025-12-06 19:16:28','2025-12-06 16:16:28','active'),(3,2,'$2b$10$OuRnj1wDp5Ucrut1ywNI5e6wTDNU3lEKFArbnemQb5GW3DDoRxCv2',0,'master','2025-12-06 17:51:50',NULL,'2025-12-06 18:07:26',NULL,'2025-12-08 17:45:20','active'),(4,1,'$2b$10$wa6k2YqOZfIh0nly1kJC4u3VGb.MWockrh6lwHSgC4XTRFvpIxFmq',0,'master','2025-12-06 20:11:00',NULL,'2025-12-06 20:11:00',NULL,'2025-12-08 17:45:20','active'),(4,3,'$2b$10$/ps4d.lC6DCpSQB3uAPare3WM7OjU2OHxwC.jyGTf6rzWwawy1MRK',0,'master','2025-12-15 13:09:22',NULL,'2025-12-15 13:09:22',NULL,'2025-12-19 16:51:40','active'),(4,4,'$2b$10$m.DLOlFfiEmUzwct2.cMnOykVnqBR9QvbiMjK61qwaWbbzRDVEU.q',1,'user','2025-12-07 12:42:52',1,'2025-12-07 12:42:52','2025-12-07 12:42:52','2025-12-07 09:42:52','active'),(4,5,'$2b$10$ZdG4QxNgL9ld.8FFLPMiVueB6rnwkfUdDR51LqqIw35qJFxr9lGCm',1,'user','2025-12-15 14:23:54',3,'2025-12-15 14:23:54',NULL,NULL,'active'),(5,3,'$2b$10$WP4pXiVbPXeXXP43Y.F1V.4bNjxRL4mYMDDcY3OnQaopdEH2D1jFm',0,'master','2025-12-07 00:42:55',NULL,'2025-12-07 00:42:55',NULL,'2025-12-08 17:45:20','active'),(5,6,'$2b$10$6O9I5ipwtX0plVlOtPylI.GYcN6ItwCzPIv6dTC6S7RCRBCI0TJmK',1,'master','2025-12-15 18:37:59',NULL,'2025-12-15 18:37:59',NULL,'2025-12-15 15:40:00','active'),(6,1,'$2b$10$SNFoPqQsFul1xwFUQV27cOTgKUyU/xls.jpOSV.fEzGClBxt9KSgi',0,'master','2025-12-07 18:54:51',NULL,'2025-12-07 18:54:51',NULL,'2025-12-11 21:16:26','active');
/*!40000 ALTER TABLE `project_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,'Novo Teste','2025-12-12 11:10:30'),(4,'FOCCUS','2025-12-15 13:09:22'),(5,'Test Project','2025-12-15 18:37:59');
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `retiradas`
--

DROP TABLE IF EXISTS `retiradas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `retiradas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comprovante_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista` date DEFAULT NULL,
  `data_real` date DEFAULT NULL,
  `account_id` int NOT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `retiradas_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `retiradas_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `retiradas_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `retiradas`
--

LOCK TABLES `retiradas` WRITE;
/*!40000 ALTER TABLE `retiradas` DISABLE KEYS */;
INSERT INTO `retiradas` VALUES (1,'',NULL,10000.00,'2025-12-16','2025-12-16','2025-12-16',1,1,4,1,'2025-12-16 16:28:57'),(2,'',NULL,13000.00,'2025-12-16','2025-12-16','2025-12-16',1,1,4,1,'2025-12-16 16:43:37'),(3,'',NULL,1000.00,'2025-12-19','2025-12-19','2025-12-19',1,1,4,1,'2025-12-19 19:16:58');
/*!40000 ALTER TABLE `retiradas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `saidas`
--

DROP TABLE IF EXISTS `saidas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `saidas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comprovante_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista_pagamento` date DEFAULT NULL,
  `data_prevista_atraso` date DEFAULT NULL,
  `data_real_pagamento` date DEFAULT NULL,
  `tipo_saida_id` int NOT NULL,
  `account_id` int NOT NULL,
  `company_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `centro_custo_id` int DEFAULT NULL,
  `forma_pagamento` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tipo_saida_id` (`tipo_saida_id`),
  KEY `account_id` (`account_id`),
  KEY `company_id` (`company_id`),
  KEY `project_id` (`project_id`),
  KEY `fk_saidas_centro_custo` (`centro_custo_id`),
  CONSTRAINT `fk_saidas_centro_custo` FOREIGN KEY (`centro_custo_id`) REFERENCES `centros_custo` (`id`),
  CONSTRAINT `saidas_ibfk_1` FOREIGN KEY (`tipo_saida_id`) REFERENCES `tipo_saida` (`id`),
  CONSTRAINT `saidas_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `saidas_ibfk_3` FOREIGN KEY (`company_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `saidas_ibfk_4` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `saidas`
--

LOCK TABLES `saidas` WRITE;
/*!40000 ALTER TABLE `saidas` DISABLE KEYS */;
INSERT INTO `saidas` VALUES (1,'',NULL,50.00,'2025-12-15','2025-12-15',NULL,NULL,2,1,1,4,1,'2025-12-15 14:40:43',NULL,NULL),(2,'','/uploads/receipts/1765899544788-393453815.pdf',300.00,'2025-12-16','2025-12-16',NULL,'2025-12-16',2,1,1,4,1,'2025-12-16 15:39:04',NULL,NULL);
/*!40000 ALTER TABLE `saidas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipo_entrada`
--

DROP TABLE IF EXISTS `tipo_entrada`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipo_entrada` (
  `id` int NOT NULL AUTO_INCREMENT,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipo_entrada`
--

LOCK TABLES `tipo_entrada` WRITE;
/*!40000 ALTER TABLE `tipo_entrada` DISABLE KEYS */;
INSERT INTO `tipo_entrada` VALUES (1,'Consultoria',NULL,0,1,1,4,'2025-12-15 14:24:21'),(2,'Cliente 1',1,0,1,1,4,'2025-12-15 14:24:28'),(3,'Cliente 2',1,1,1,1,4,'2025-12-15 14:24:34'),(4,'Software',NULL,1,1,1,4,'2025-12-15 14:24:39'),(5,'CASH',4,0,1,1,4,'2025-12-15 14:24:44'),(6,'STOCKSPIN',4,1,1,1,4,'2025-12-15 14:24:50'),(7,'Consultoria',NULL,0,1,1,5,'2025-12-15 19:10:27'),(8,'Juri',7,0,1,1,5,'2025-12-15 19:10:32'),(9,'Software',NULL,1,1,1,5,'2025-12-15 19:10:38'),(10,'CASH',9,0,1,1,5,'2025-12-15 19:10:43'),(11,'STOCKSPIN',9,1,1,1,5,'2025-12-15 19:10:49');
/*!40000 ALTER TABLE `tipo_entrada` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipo_producao_revenda`
--

DROP TABLE IF EXISTS `tipo_producao_revenda`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipo_producao_revenda` (
  `id` int NOT NULL AUTO_INCREMENT,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipo_producao_revenda`
--

LOCK TABLES `tipo_producao_revenda` WRITE;
/*!40000 ALTER TABLE `tipo_producao_revenda` DISABLE KEYS */;
INSERT INTO `tipo_producao_revenda` VALUES (1,'Insumos',NULL,0,1,1,4,'2025-12-15 14:35:02'),(2,'Leite',1,0,1,1,4,'2025-12-15 14:35:50'),(3,'Produtos',NULL,1,1,1,4,'2025-12-15 14:36:04'),(4,'Coca-Cola',3,0,1,1,4,'2025-12-15 14:36:10'),(5,'Revenda',NULL,0,1,1,5,'2025-12-15 19:11:21'),(6,'Coca-cola',5,0,1,1,5,'2025-12-15 19:11:29'),(7,'Produção',NULL,1,1,1,5,'2025-12-15 19:11:38'),(8,'Tecido',7,0,1,1,5,'2025-12-15 19:11:43');
/*!40000 ALTER TABLE `tipo_producao_revenda` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipo_saida`
--

DROP TABLE IF EXISTS `tipo_saida`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipo_saida` (
  `id` int NOT NULL AUTO_INCREMENT,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipo_saida`
--

LOCK TABLES `tipo_saida` WRITE;
/*!40000 ALTER TABLE `tipo_saida` DISABLE KEYS */;
INSERT INTO `tipo_saida` VALUES (1,'Despesas',NULL,0,1,1,4,'2025-12-15 14:32:01'),(2,'Contador',1,0,1,1,4,'2025-12-15 14:32:07'),(3,'Empregada',1,1,1,1,4,'2025-12-15 14:32:17'),(4,'Despesas',NULL,0,1,1,5,'2025-12-15 19:10:59'),(5,'Empregada',4,0,1,1,5,'2025-12-15 19:11:04');
/*!40000 ALTER TABLE `tipo_saida` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transferencias`
--

DROP TABLE IF EXISTS `transferencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transferencias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `descricao` text COLLATE utf8mb4_unicode_ci,
  `valor` decimal(15,2) NOT NULL,
  `data_fato` date DEFAULT NULL,
  `data_prevista` date DEFAULT NULL,
  `data_real` date DEFAULT NULL,
  `source_account_id` int DEFAULT NULL,
  `destination_account_id` int DEFAULT NULL,
  `project_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `comprovante_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `source_account_id` (`source_account_id`),
  KEY `destination_account_id` (`destination_account_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `transferencias_ibfk_1` FOREIGN KEY (`source_account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `transferencias_ibfk_2` FOREIGN KEY (`destination_account_id`) REFERENCES `contas` (`id`),
  CONSTRAINT `transferencias_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transferencias`
--

LOCK TABLES `transferencias` WRITE;
/*!40000 ALTER TABLE `transferencias` DISABLE KEYS */;
INSERT INTO `transferencias` VALUES (1,'',1000.00,'2025-12-16','2025-12-16','2025-12-16',1,2,4,1,'/uploads/receipts/1765909816553-135713879.pdf','2025-12-16 18:09:49','2025-12-16 18:30:16'),(2,'fsd',100.00,'2025-12-19','2025-12-19','2025-12-19',1,2,4,1,'/uploads/1766158005288-erd_financeiro.pdf','2025-12-19 15:26:54','2025-12-19 15:30:53');
/*!40000 ALTER TABLE `transferencias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `password_reset_required` tinyint(1) DEFAULT '0',
  `password_reset_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_reset_expires` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `invited_by` int DEFAULT NULL,
  `invited_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `project_id` (`project_id`),
  KEY `idx_password_reset_token` (`password_reset_token`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (3,'Augusto','agomes@foccusgestao.com.br','$2b$10$/ps4d.lC6DCpSQB3uAPare3WM7OjU2OHxwC.jyGTf6rzWwawy1MRK',NULL,'2025-12-15 13:09:22',0,NULL,NULL,1,NULL,NULL),(5,'asdf','test@test.com','$2b$10$ZdG4QxNgL9ld.8FFLPMiVueB6rnwkfUdDR51LqqIw35qJFxr9lGCm',NULL,'2025-12-15 14:23:54',0,NULL,NULL,1,NULL,NULL),(6,'Test User','test@example.com','$2b$10$6O9I5ipwtX0plVlOtPylI.GYcN6ItwCzPIv6dTC6S7RCRBCI0TJmK',NULL,'2025-12-15 18:37:59',0,NULL,NULL,1,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'cash_db'
--

--
-- Dumping routines for database 'cash_db'
--
/*!50003 DROP PROCEDURE IF EXISTS `GetChildren` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetChildren`(IN parent_node_id INT)
BEGIN
    SELECT * FROM tipo_entrada 
    WHERE parent_id = parent_node_id 
    ORDER BY ordem;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `GetTipoDespesaTree` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetTipoDespesaTree`()
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `GetTipoEntradaTree` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetTipoEntradaTree`()
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `GetTipoProducaoRevendaTree` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetTipoProducaoRevendaTree`()
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `MoveTipoDespesa` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `MoveTipoDespesa`(
    IN node_id INT,
    IN new_parent_id INT,
    IN new_ordem INT
)
BEGIN
    UPDATE tipo_despesa 
    SET parent_id = new_parent_id, ordem = new_ordem
    WHERE id = node_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `MoveTipoEntrada` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `MoveTipoEntrada`(
    IN node_id INT,
    IN new_parent_id INT,
    IN new_ordem INT
)
BEGIN
    UPDATE tipo_entrada 
    SET parent_id = new_parent_id, ordem = new_ordem
    WHERE id = node_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `MoveTipoProducaoRevenda` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `MoveTipoProducaoRevenda`(
    IN node_id INT,
    IN new_parent_id INT,
    IN new_ordem INT
)
BEGIN
    UPDATE tipo_producao_revenda 
    SET parent_id = new_parent_id, ordem = new_ordem
    WHERE id = node_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-19 17:02:13

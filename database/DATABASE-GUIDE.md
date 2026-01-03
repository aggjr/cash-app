# 📊 Como Visualizar o Banco de Dados CASH

## Estrutura do Banco de Dados

### Banco: `cash_db`

### Tabela: `tipo_entrada`

```
+------------+--------------+------+-----+-------------------+
| Campo      | Tipo         | Null | Key | Extra             |
+------------+--------------+------+-----+-------------------+
| id         | INT          | NO   | PRI | AUTO_INCREMENT    |
| label      | VARCHAR(255) | NO   |     |                   |
| parent_id  | INT          | YES  | FK  |                   |
| ordem      | INT          | YES  |     | DEFAULT 0         |
| expanded   | BOOLEAN      | YES  |     | DEFAULT TRUE      |
| created_at | TIMESTAMP    | YES  |     | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP    | YES  |     | ON UPDATE         |
+------------+--------------+------+-----+-------------------+
```

## Diagrama ER (Entidade-Relacionamento)

```
┌─────────────────────────────────────┐
│         tipo_entrada                │
├─────────────────────────────────────┤
│ PK  id (INT, AUTO_INCREMENT)        │
│     label (VARCHAR 255)             │
│ FK  parent_id (INT, NULL)           │
│     ordem (INT)                     │
│     expanded (BOOLEAN)              │
│     created_at (TIMESTAMP)          │
│     updated_at (TIMESTAMP)          │
└─────────────────────────────────────┘
         │
         │ Self-Referencing
         │ (parent_id → id)
         │
         ▼
```

### Relacionamentos:
- **Self-Referencing**: `parent_id` → `id` (para estrutura de árvore)
- **CASCADE DELETE**: Ao deletar um pai, todos os filhos são deletados

## Stored Procedures

1. **GetTipoEntradaTree()** - Retorna árvore completa com profundidade
2. **MoveTipoEntrada(node_id, new_parent_id, new_ordem)** - Move um nó
3. **GetChildren(parent_node_id)** - Retorna filhos de um nó

## Como Visualizar

### 1. MySQL Workbench (Interface Gráfica)

**Abrir Workbench:**
1. Inicie o MySQL Workbench
2. Conecte à instância local
3. Digite sua senha

**Ver Tabelas:**
- Painel esquerdo → Schemas → cash_db → Tables → tipo_entrada
- Clique direito → "Select Rows" para ver dados

**Ver Diagrama ER:**
1. Menu: `Database` → `Reverse Engineer...`
2. Selecione conexão local
3. Selecione schema `cash_db`
4. Clique `Next` até o final
5. Visualize o diagrama!

### 2. MySQL Shell (Linha de Comando)

```bash
# Abrir MySQL Shell
mysql -u root -p

# Comandos SQL
USE cash_db;
SHOW TABLES;
DESCRIBE tipo_entrada;
SELECT * FROM tipo_entrada;
```

### 3. Script de Visualização

Execute o script que criei:
```bash
cd database
mysql -u root -p < view-database.sql
```

### 4. Via Navegador (phpMyAdmin - se tiver XAMPP)

Se você instalou XAMPP:
1. Abra: http://localhost/phpmyadmin
2. Clique em `cash_db` no menu esquerdo
3. Navegue pelas tabelas

## Dados Atuais

```sql
-- Estrutura atual dos dados:
Receita Operacional (id: 1)
├── STOCKSPIN (id: 2)
│   └── SARON (id: 4)
└── TELECOM (id: 3)
    └── CIMCOP (id: 5)
```

## Consultas Úteis

### Ver árvore hierárquica:
```sql
WITH RECURSIVE tree AS (
    SELECT id, label, parent_id, 0 AS depth
    FROM tipo_entrada
    WHERE parent_id IS NULL
    UNION ALL
    SELECT t.id, t.label, t.parent_id, tree.depth + 1
    FROM tipo_entrada t
    INNER JOIN tree ON t.parent_id = tree.id
)
SELECT 
    CONCAT(REPEAT('  ', depth), label) AS hierarquia,
    id,
    parent_id,
    depth
FROM tree
ORDER BY depth, id;
```

### Ver apenas raízes:
```sql
SELECT * FROM tipo_entrada WHERE parent_id IS NULL;
```

### Contar filhos de cada nó:
```sql
SELECT 
    p.id,
    p.label,
    COUNT(c.id) AS total_filhos
FROM tipo_entrada p
LEFT JOIN tipo_entrada c ON c.parent_id = p.id
GROUP BY p.id, p.label;
```

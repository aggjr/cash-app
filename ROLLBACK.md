# Baseline e Rollback - Guia Completo

## 📌 Baseline Criada

**Data:** 2025-12-23
**Versão:** v1.0.0-export-features
**Git Tag:** `v1.0.0-export-features`
**Commit:** `0a729a5`

### Funcionalidades nesta Baseline

Esta baseline inclui:
- ✅ Excel/PDF export em todas as telas de transações (Entradas, Saídas, Aportes, Retiradas, Produção/Revenda)
- ✅ Excel/PDF export em todas as telas de relatórios (Fechamento Contas, Extrato, Consolidadas, Previsão Fluxo)
- ✅ Formatação automática de moeda e datas nos exports
- ✅ Hierarquias preservadas em exports (Consolidadas e Previsão Fluxo)
- ✅ Correções no backend (aporteController.js)

---

## 🔄 Como Fazer Rollback

### 1. Rollback do Código

#### Opção A: Rollback Completo (Recomendado)

```powershell
# 1. Voltar para a tag da baseline
git checkout v1.0.0-export-features

# 2. Criar um branch temporário (opcional, para testes)
git checkout -b rollback-test

# 3. Se tudo estiver OK, forçar o master para esta versão
git checkout master
git reset --hard v1.0.0-export-features
git push origin master --force
```

#### Opção B: Rollback Parcial (Reverter commits específicos)

```powershell
# Reverter os últimos N commits
git revert HEAD~N..HEAD

# Exemplo: reverter últimos 3 commits
git revert HEAD~3..HEAD

# Push das reversões
git push origin master
```

#### Opção C: Criar branch de emergência

```powershell
# Criar branch a partir da baseline
git checkout -b emergency-hotfix v1.0.0-export-features

# Fazer correções necessárias
# ...

# Merge de volta para master
git checkout master
git merge emergency-hotfix
git push origin master
```

---

### 2. Rollback do Banco de Dados

#### Criar Backup ANTES de qualquer mudança

```powershell
# Backup completo do schema (sem dados)
node scripts/backup_schema.js

# Backup com dados (ATENÇÃO: pode ser grande!)
node scripts/backup_schema.js --with-data
```

**Backups salvos em:** `database/backups/`

#### Restaurar Backup

```powershell
# Conectar ao banco de dados
# OPÇÃO 1: Via MySQL CLI
mysql -h <host> -u <user> -p <database> < database/backups/schema_latest.sql

# OPÇÃO 2: Via script Node.js
node scripts/restore_schema.js database/backups/schema_latest.sql
```

#### Rollback Manual (se necessário)

Se você fez migrations que precisam ser revertidas:

1. Identifique as migrations aplicadas após a baseline
2. Execute os scripts de rollback na ordem inversa
3. Verifique a integridade do banco

```sql
-- Exemplo: reverter adição de coluna
ALTER TABLE table_name DROP COLUMN column_name;

-- Exemplo: reverter criação de tabela
DROP TABLE IF EXISTS table_name;
```

---

## 📋 Checklist de Rollback

Use este checklist quando precisar fazer rollback:

### Antes do Rollback
- [ ] Identificar a causa do problema
- [ ] Determinar se rollback é realmente necessário
- [ ] **CRIAR BACKUP DO ESTADO ATUAL** (caso precise investigar depois)
- [ ] Notificar stakeholders sobre o rollback
- [ ] Ter a tag/commit da baseline em mãos: `v1.0.0-export-features`

### Durante o Rollback

#### Código
- [ ] Fazer checkout da tag baseline
- [ ] Testar localmente
- [ ] Push para produção (Easypanel)
- [ ] Verificar deploy bem-sucedido

#### Banco de Dados
- [ ] Fazer backup do estado atual
- [ ] Identificar migrations para reverter
- [ ] Executar rollback de migrations/schema
- [ ] Verificar integridade dos dados
- [ ] Testar queries críticas

### Depois do Rollback
- [ ] Testar funcionalidades principais
- [ ] Verificar logs de erro
- [ ] Confirmar que o problema foi resolvido
- [ ] Documentar o incidente
- [ ] Planejar correção adequada

---

## 🔍 Verificação de Integridade

### Código

```powershell
# Verificar que está na tag correta
git describe --tags

# Ver diferenças entre versão atual e baseline
git diff v1.0.0-export-features

# Listar tags disponíveis
git tag -l
```

### Banco de Dados

```sql
-- Verificar estrutura das tabelas principais
SHOW TABLES;

-- Verificar colunas de uma tabela
DESCRIBE entradas;
DESCRIBE aportes;

-- Verificar integridade referencial
SELECT 
    TABLE_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'your_database'
AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Contar registros
SELECT 
    'entradas' as tabela, COUNT(*) as total FROM entradas
UNION ALL
SELECT 'saidas', COUNT(*) FROM saidas
UNION ALL
SELECT 'aportes', COUNT(*) FROM aportes
UNION ALL
SELECT 'retiradas', COUNT(*) FROM retiradas;
```

---

## 📊 Histór ico de Baselines

| Versão | Data | Tag | Principais Mudanças |
|--------|------|-----|---------------------|
| v1.0.0-export-features | 2025-12-23 | `v1.0.0-export-features` | Excel/PDF export em todas as telas |

---

## 🚨 Contatos de Emergência

Em caso de problemas durante rollback:

1. **Verificar logs do Easypanel**
2. **Verificar logs do banco de dados**
3. **Consultar esta documentação**
4. **Se necessário, contactar suporte**

---

## 📝 Notas Importantes

### Git Tags
- Tags são imutáveis (não podem ser alteradas)
- Sempre use tags anotadas (`git tag -a`) para baselines
- Tags devem seguir versionamento semântico (v1.0.0)

### Banco de Dados
- **SEMPRE** faça backup antes de qualquer mudança em produção
- Backups automáticos não substituem backups manuais antes de rollback
- Teste o restore de backups regularmente

### Easypanel
- Rollback de código requer rebuild da aplicação
- Pode levar alguns minutos para aplicar
- Verifique os logs de deploy

---

## 🔗 Links Úteis

- **Repositório GitHub:** https://github.com/aggjr/cash-app
- **Tag desta baseline:** https://github.com/aggjr/cash-app/releases/tag/v1.0.0-export-features
- **Documentação do Git:** https://git-scm.com/docs

---

**Última atualização:** 2025-12-23
**Responsável:** Equipe de Desenvolvimento

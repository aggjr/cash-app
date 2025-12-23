# 🗄️ Backup Completo do Banco de Dados de Produção

## Objetivo
Criar um backup COMPLETO (estrutura + dados) do banco de produção que permita recriar o banco de dados inteiro do zero.

---

## 📋 Passo a Passo

### 1. Acessar Console do Easypanel

1. Ir em **Easypanel** → **Services** → **cash/cash-app**
2. Clicar no serviço **cash-db** (MySQL)
3. Abrir o **Console** → Aba **Bash**

### 2. Executar Comando de Backup COMPLETO

No console Bash do Easypanel, execute:

```bash
mysqldump -h localhost -u root -pMDzwJ1407791 --set-gtid-purged=OFF cash > /tmp/PRODUCTION_FULL_BACKUP_$(date +%Y%m%d_%H%M%S).sql
```

**OU, se já estiver no diretório /:**

```bash
mysqldump -h localhost -u root -pMDzwJ1407791 --set-gtid-purged=OFF cash > /tmp/prod_full_backup.sql
```

### 3. Verificar o Backup

```bash
# Ver tamanho do arquivo
ls -lh /tmp/prod_full_backup.sql

# Ver quantas linhas (deve ser MUITO mais que 4!)
wc -l /tmp/prod_full_backup.sql

# Ver as primeiras linhas
head -20 /tmp/prod_full_backup.sql
```

### 4. Copiar o Conteúdo

```bash
cat /tmp/prod_full_backup.sql
```

**IMPORTANTE:** O arquivo será GRANDE (com todos os dados). Você precisa:

1. Rolar até o INÍCIO do console
2. Selecionar TODO o conteúdo SQL
3. Copiar (pode levar alguns segundos)
4. Colar em um arquivo local

---

## 💾 Salvar Localmente

Depois de copiar o conteúdo, salve em:

```
database/backups/PRODUCTION_FULL_BACKUP_2025-12-23.sql
```

E também como:

```
database/backups/PRODUCTION_latest_FULL.sql
```

---

## 🔄 Como Restaurar o Backup Completo

### Restaurar Localmente (Desenvolvimento)

```powershell
# No PowerShell, na raiz do projeto
mysql -u root -p cash_db < database/backups/PRODUCTION_FULL_BACKUP_2025-12-23.sql
```

### Restaurar em Produção (Easypanel)

No console Bash do Easypanel:

```bash
# 1. Fazer upload do arquivo SQL para /tmp/restore.sql
# 2. Executar:
mysql -h localhost -u root -pMDzwJ1407791 cash < /tmp/restore.sql
```

---

## ⚠️ Observações Importantes

### Tamanho do Arquivo
- **Backup só estrutura:** ~17 KB
- **Backup completo (com dados):** Pode ser 100+ KB até vários MB dependendo da quantidade de dados

### Segurança
- ⚠️ **NÃO commitar backup com dados no Git!**
- Dados de produção contêm informações sensíveis
- Mantenha backups localmente ou em storage seguro

### Quando Usar

**Backup só estrutura (atual):**
- ✅ Para versionamento de schema
- ✅ Para rollback de migrations
- ✅ Para setup de ambiente de desenvolvimento

**Backup completo (com dados):**
- ✅ Para disaster recovery
- ✅ Para replicar ambiente de produção em staging
- ✅ Para auditoria/análise

---

## 📝 Checklist de Backup

- [ ] Executar mysqldump no Easypanel
- [ ] Verificar tamanho do arquivo (> 17KB)
- [ ] Copiar conteúdo completo
- [ ] Salvar em `database/backups/PRODUCTION_FULL_BACKUP_2025-12-23.sql`
- [ ] Salvar também como `PRODUCTION_latest_FULL.sql`
- [ ] Testar restore em ambiente local
- [ ] **NÃO** commitar no Git
- [ ] Armazenar em local seguro

---

## 🎯 Arquivos de Backup Recomendados

```
database/backups/
├── schema_baseline_2025-12-23_11-11-30.sql      # Estrutura local (no Git)
├── schema_baseline_latest.sql                    # Estrutura local (no Git)
├── PRODUCTION_FULL_BACKUP_2025-12-23.sql        # Completo prod (LOCAL ONLY!)
└── PRODUCTION_latest_FULL.sql                    # Completo prod (LOCAL ONLY!)
```

---

**Data:** 2025-12-23  
**Versão:** v1.0.0-export-features

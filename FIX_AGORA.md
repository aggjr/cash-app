# 🔧 CORREÇÃO URGENTE - Variáveis de Ambiente

## ⚠️ PROBLEMA IDENTIFICADO
As variáveis de ambiente estão INCORRETAS (em português e com valores errados).

## ✅ SOLUÇÃO RÁPIDA

Siga estes passos no Easypanel:

### 1. Acesse as Variáveis de Ambiente
- Vá em: **Projetos** → **dinheiro** → **aplicativo de dinheiro** → **Ambiente**

### 2. DELETE TODAS as variáveis existentes
Clique no ❌ de cada uma dessas variáveis incorretas:
- `NODE_ENV=produção`
- `PORTA=3000`
- `DB_HOST=cash_cash-db`
- `DB_USER=agomes`
- `DB_PASSWORD=...`
- `DB_NAME='banco de dados em dinheiro'`
- `JWT_SECRET=segredo_super_seguro_123`

### 3. ADICIONE estas 8 variáveis NOVAS

Clique em **"Adicionar Variável"** ou **"Add Variable"** para cada uma:

| Nome | Valor |
|------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DB_HOST` | `mysql-workbench` |
| `DB_PORT` | `3306` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | `Dani160779!` |
| `DB_NAME` | `cash_db` |
| `JWT_SECRET` | `NlBUZRLF2Ie50KWYzhXvtQx7D3qjbG4EdMmgsyoVASfi1rHpPn8Tu6kcOaw9CJ` |

### 4. SALVE e REIMPLANTE
- Clique em **"Salvar"** ou **"Save"**
- Clique em **"Implantar"** ou **"Deploy"** ou **"Redeploy"**

### 5. AGUARDE o Deploy
- Vá na aba **"Logs"**
- Aguarde ver: `🚀 Rocket CASH Backend API Server`
- Isso leva 2-5 minutos

### 6. TESTE
- Acesse: `https://cash.gutoapps.site`
- Deve aparecer a tela de login SEM erro 500!

---

## 📋 Valores para Copiar/Colar

**DB_PASSWORD:**
```
Dani160779!
```

**JWT_SECRET:**
```
NlBUZRLF2Ie50KWYzhXvtQx7D3qjbG4EdMmgsyoVASfi1rHpPn8Tu6kcOaw9CJ
```

---

## ✅ Checklist

- [ ] Deletei TODAS as variáveis antigas
- [ ] Adicionei NODE_ENV = production
- [ ] Adicionei PORT = 3000
- [ ] Adicionei DB_HOST = mysql-workbench
- [ ] Adicionei DB_PORT = 3306
- [ ] Adicionei DB_USER = root
- [ ] Adicionei DB_PASSWORD = Dani160779!
- [ ] Adicionei DB_NAME = cash_db
- [ ] Adicionei JWT_SECRET = (string longa)
- [ ] Salvei as alterações
- [ ] Cliquei em Implantar/Deploy
- [ ] Aguardei os logs mostrarem sucesso
- [ ] Testei em https://cash.gutoapps.site

---

**Depois de fazer isso, me avise e eu verifico se está tudo funcionando!**

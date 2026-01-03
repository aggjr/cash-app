# 🚀 CASH - Configuração no Easypanel

## ✅ Código já está no GitHub!
Repositório: `https://github.com/aggjr/cash-app.git`
Branch: `master`

---

## 📝 PASSO 1: Criar Serviço MySQL

1. No Easypanel, vá em **Projetos** → **dinheiro**
2. Clique em **"+ Novo"**
3. Selecione **"MySQL"**
4. Configure:
   - **Nome do serviço**: `cash-db`
   - **Versão**: `8.0` ou `latest`
   - **Root Password**: O Easypanel vai gerar uma senha. **COPIE E GUARDE!**
   - **Database Name**: `cash_db`
5. Clique em **"Criar"**
6. **IMPORTANTE**: Anote o **Internal Host** (geralmente é `cash-db`)

---

## 📝 PASSO 2: Criar Serviço da Aplicação

1. No projeto **"dinheiro"**, clique em **"+ Novo"**
2. Selecione **"App"**

### 2.1 - Source (Código Fonte)

- **Git Provider**: `GitHub`
- **Repository**: `aggjr/cash-app`
- **Branch**: `master`
- Se pedir autenticação, use seu token do GitHub

### 2.2 - Build

- **Build Method**: `Docker`
- **Docker Context**: `/` (deixe como está)
- **Dockerfile Path**: `Dockerfile` (o arquivo na raiz do projeto)

### 2.3 - Environment Variables (IMPORTANTE!)

Clique em **"Add Variable"** para cada uma dessas variáveis:

```
NODE_ENV = production
PORT = 3000
DB_HOST = cash-db
DB_PORT = 3306
DB_USER = root
DB_PASSWORD = [COLE A SENHA DO MYSQL QUE VOCÊ ANOTOU]
DB_NAME = cash_db
JWT_SECRET = [GERE UMA STRING ALEATÓRIA - VER ABAIXO]
```

**Para gerar o JWT_SECRET**, abra o PowerShell e execute:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```
Copie o resultado e cole no campo `JWT_SECRET`.

### 2.4 - Domains (Domínio)

- Clique em **"Add Domain"**
- Digite: `cash.gutoapps.site`
- Marque **"Enable HTTPS"** (para SSL automático)

### 2.5 - Port Mapping

- **Container Port**: `3000`
- Deixe o Easypanel configurar automaticamente as portas públicas

### 2.6 - Deploy!

- Clique em **"Deploy"** ou **"Save & Deploy"**

---

## 📊 PASSO 3: Monitorar o Deploy

1. Vá na aba **"Logs"** do serviço da aplicação
2. Você verá:
   ```
   Building image...
   ⏳ Waiting for Database...
   🚀 Running Migrations...
   ✅ Migrations completed.
   🟢 Starting Server...
   🚀 Rocket CASH Backend API Server
   ```

3. Aguarde até ver a mensagem de sucesso (pode levar 2-5 minutos)

---

## ✅ PASSO 4: Testar

1. Acesse: `https://cash.gutoapps.site`
2. Você deve ver a tela de login do CASH
3. Teste criar uma conta e fazer login

---

## 🔧 Se der erro...

### Erro: "Cannot connect to database"
- Verifique se `DB_HOST` = `cash-db` (nome do serviço MySQL)
- Verifique se a `DB_PASSWORD` está correta
- Verifique se o MySQL está rodando (vá no serviço MySQL e veja se está "Running")

### Erro: "502 Bad Gateway"
- Aguarde mais tempo (migrações podem demorar)
- Veja os logs do aplicativo para detalhes

### Erro de Build
- Verifique se o repositório GitHub está acessível
- Veja os logs de build para detalhes

---

## 📋 Checklist Rápido

- [ ] MySQL criado e rodando
- [ ] Senha do MySQL anotada
- [ ] App criado com repositório `aggjr/cash-app`
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Domínio `cash.gutoapps.site` adicionado
- [ ] HTTPS habilitado
- [ ] Deploy executado
- [ ] Logs mostram sucesso
- [ ] Site acessível em `https://cash.gutoapps.site`

---

**Dúvidas? Veja os logs ou me avise se encontrar algum erro!**

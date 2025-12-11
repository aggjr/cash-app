# 🚀 Quick Start - Deploy CASH em Produção

## Resumo Rápido

Este é um guia resumido para deploy. Para instruções completas, veja [DEPLOY_PRODUCTION.md](DEPLOY_PRODUCTION.md).

## Pré-requisitos

- Servidor Linux com Docker e Docker Compose instalados
- DNS `cash.gutoapps.site` apontando para o IP do servidor
- Portas 80 e 443 liberadas no firewall

## Deploy em 5 Passos

### 1️⃣ Transferir arquivos para o servidor

```bash
# Via Git (recomendado)
git clone https://github.com/seu-usuario/cash-app.git
cd cash-app

# OU via SCP
scp -r ./CASH usuario@servidor:/home/usuario/cash-app
ssh usuario@servidor
cd cash-app
```

### 2️⃣ Configurar variáveis de ambiente

```bash
# Copiar template
cp env.production.template .env.production

# Gerar senhas fortes
echo "DB_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 64)"

# Editar arquivo
nano .env.production
```

Cole as senhas geradas acima no arquivo `.env.production`:
```bash
DB_PASSWORD=sua_senha_gerada_aqui
JWT_SECRET=seu_jwt_secret_gerado_aqui
```

### 3️⃣ Configurar email para SSL

Edite `docker-compose.prod.yml` e altere o email do Certbot:

```bash
nano docker-compose.prod.yml
```

Procure por `your-email@example.com` e substitua pelo seu email.

### 4️⃣ Executar deploy

```bash
# Dar permissão
chmod +x deploy-production.sh

# Executar
./deploy-production.sh
```

### 5️⃣ Verificar

Abra o navegador e acesse: **https://cash.gutoapps.site**

## Comandos Úteis

```bash
# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Ver status
docker-compose -f docker-compose.prod.yml ps

# Reiniciar
docker-compose -f docker-compose.prod.yml restart

# Parar
docker-compose -f docker-compose.prod.yml stop

# Backup do banco
docker exec cash_db_prod mysqldump -u root -p${DB_PASSWORD} cash_db > backup.sql
```

## Problemas?

Consulte o [guia completo de troubleshooting](DEPLOY_PRODUCTION.md#-troubleshooting).

## Arquivos Criados

- ✅ `docker-compose.prod.yml` - Configuração Docker para produção
- ✅ `Dockerfile.prod` - Build do frontend com Nginx
- ✅ `nginx.prod.conf` - Configuração Nginx com SSL
- ✅ `env.production.template` - Template de variáveis de ambiente
- ✅ `deploy-production.sh` - Script de deploy (Linux/Mac)
- ✅ `deploy-production.ps1` - Script de deploy (Windows)
- ✅ `DEPLOY_PRODUCTION.md` - Guia completo de deploy

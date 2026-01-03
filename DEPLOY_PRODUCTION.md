# Guia de Deploy em Produção - CASH System

## 📋 Visão Geral

Este guia descreve como fazer o deploy do sistema CASH em produção usando Docker com SSL/HTTPS.

**Domínios configurados:**
- Aplicação: `cash.gutoapps.site`
- Banco de dados: `mysql.gutoapps.site` (apenas para referência, não exposto publicamente)

## 🔧 Pré-requisitos

### No Servidor
- **Sistema Operacional**: Linux (Ubuntu/Debian recomendado)
- **Docker**: versão 20.10 ou superior
- **Docker Compose**: versão 2.0 ou superior
- **Portas liberadas**: 80 (HTTP) e 443 (HTTPS)
- **DNS configurado**: `cash.gutoapps.site` apontando para o IP do servidor

### Verificar instalação do Docker
```bash
docker --version
docker-compose --version
```

Se não estiver instalado, instale com:
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

## 📦 Preparação

### 1. Transferir arquivos para o servidor

Copie todo o projeto para o servidor (você pode usar `scp`, `rsync`, ou `git clone`):

```bash
# Opção 1: Via Git (recomendado)
git clone https://github.com/seu-usuario/cash-app.git
cd cash-app

# Opção 2: Via SCP (do seu computador local)
scp -r ./CASH usuario@seu-servidor:/home/usuario/cash-app
```

### 2. Configurar variáveis de ambiente

Copie o template e edite com suas credenciais:

```bash
cp env.production.template .env.production
nano .env.production
```

**IMPORTANTE**: Altere os seguintes valores:

```bash
# Gere uma senha forte para o banco de dados
DB_PASSWORD=SuaSenhaForteAqui123!@#

# Gere um JWT secret aleatório (mínimo 64 caracteres)
JWT_SECRET=sua_string_aleatoria_muito_longa_e_segura_aqui_com_pelo_menos_64_caracteres
```

**Dica para gerar senhas fortes:**
```bash
# Gerar senha do banco de dados
openssl rand -base64 32

# Gerar JWT secret
openssl rand -base64 64
```

### 3. Configurar email para SSL (Certbot)

Edite o arquivo `docker-compose.prod.yml` e altere o email:

```yaml
command: certonly --webroot --webroot-path=/var/www/html --email SEU_EMAIL@example.com --agree-tos --no-eff-email --force-renewal -d cash.gutoapps.site
```

## 🚀 Deploy

### Método 1: Script Automático (Recomendado)

```bash
# Dar permissão de execução
chmod +x deploy-production.sh

# Executar deploy
./deploy-production.sh
```

### Método 2: Manual

```bash
# 1. Parar containers existentes (se houver)
docker-compose -f docker-compose.prod.yml down

# 2. Construir imagens
docker-compose -f docker-compose.prod.yml build --no-cache

# 3. Iniciar serviços
docker-compose -f docker-compose.prod.yml up -d

# 4. Verificar status
docker-compose -f docker-compose.prod.yml ps

# 5. Ver logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔐 Configuração SSL (HTTPS)

### Primeira execução - Obter certificado

Na primeira execução, o Certbot tentará obter o certificado SSL automaticamente. Isso pode levar alguns minutos.

**Verificar logs do Certbot:**
```bash
docker-compose -f docker-compose.prod.yml logs certbot
```

### Renovação automática

Para configurar renovação automática do certificado (recomendado):

```bash
# Adicionar ao crontab
crontab -e

# Adicionar esta linha (renova a cada 12 horas)
0 */12 * * * cd /caminho/para/cash-app && docker-compose -f docker-compose.prod.yml run certbot renew && docker-compose -f docker-compose.prod.yml restart frontend
```

## ✅ Verificação

### 1. Verificar se os containers estão rodando

```bash
docker-compose -f docker-compose.prod.yml ps
```

Você deve ver 4 containers rodando:
- `cash_db_prod` (MySQL)
- `cash_backend_prod` (Node.js API)
- `cash_frontend_prod` (Nginx)
- `cash_certbot` (pode estar "Exit 0" após obter certificado)

### 2. Testar a aplicação

Abra o navegador e acesse:
- `http://cash.gutoapps.site` (deve redirecionar para HTTPS)
- `https://cash.gutoapps.site` (versão segura)

### 3. Testar funcionalidades

- [ ] Página de login carrega corretamente
- [ ] Consegue criar uma conta
- [ ] Consegue fazer login
- [ ] Dashboard carrega após login
- [ ] Funcionalidades principais funcionam

## 📊 Monitoramento

### Ver logs em tempo real

```bash
# Todos os serviços
docker-compose -f docker-compose.prod.yml logs -f

# Apenas backend
docker-compose -f docker-compose.prod.yml logs -f backend

# Apenas frontend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Apenas banco de dados
docker-compose -f docker-compose.prod.yml logs -f db
```

### Verificar uso de recursos

```bash
docker stats
```

### Verificar espaço em disco

```bash
df -h
docker system df
```

## 🔄 Atualização da Aplicação

Quando houver mudanças no código:

```bash
# 1. Baixar últimas mudanças (se usando Git)
git pull

# 2. Reconstruir e reiniciar
docker-compose -f docker-compose.prod.yml up -d --build

# 3. Verificar logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 💾 Backup

### Backup do banco de dados

```bash
# Criar backup
docker exec cash_db_prod mysqldump -u root -p${DB_PASSWORD} cash_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker exec -i cash_db_prod mysql -u root -p${DB_PASSWORD} cash_db < backup_20231211_120000.sql
```

### Backup automático diário

```bash
# Adicionar ao crontab
crontab -e

# Backup diário às 2h da manhã
0 2 * * * cd /caminho/para/cash-app && docker exec cash_db_prod mysqldump -u root -p${DB_PASSWORD} cash_db > backups/backup_$(date +\%Y\%m\%d).sql
```

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"

```bash
# Verificar se o container do banco está rodando
docker-compose -f docker-compose.prod.yml ps db

# Ver logs do banco
docker-compose -f docker-compose.prod.yml logs db

# Verificar senha no .env.production
cat .env.production | grep DB_PASSWORD
```

### Erro: "502 Bad Gateway"

```bash
# Verificar se o backend está rodando
docker-compose -f docker-compose.prod.yml ps backend

# Ver logs do backend
docker-compose -f docker-compose.prod.yml logs backend

# Reiniciar backend
docker-compose -f docker-compose.prod.yml restart backend
```

### Erro: "SSL certificate not found"

```bash
# Verificar logs do certbot
docker-compose -f docker-compose.prod.yml logs certbot

# Tentar obter certificado manualmente
docker-compose -f docker-compose.prod.yml run certbot certonly --webroot --webroot-path=/var/www/html --email seu-email@example.com --agree-tos -d cash.gutoapps.site
```

### Limpar tudo e recomeçar

```bash
# CUIDADO: Isso apaga todos os dados!
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d --build
```

## 🔒 Segurança

### Checklist de Segurança

- [ ] Senha forte do banco de dados configurada
- [ ] JWT secret longo e aleatório configurado
- [ ] SSL/HTTPS funcionando corretamente
- [ ] Banco de dados NÃO exposto publicamente (sem porta externa)
- [ ] Firewall configurado (apenas portas 80, 443 e SSH abertas)
- [ ] Backups automáticos configurados
- [ ] Logs sendo monitorados

### Configurar Firewall (UFW)

```bash
# Instalar UFW
sudo apt install ufw

# Configurar regras
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Ativar firewall
sudo ufw enable

# Verificar status
sudo ufw status
```

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs: `docker-compose -f docker-compose.prod.yml logs -f`
2. Verifique o status dos containers: `docker-compose -f docker-compose.prod.yml ps`
3. Consulte a seção de Troubleshooting acima
4. Verifique se o DNS está configurado corretamente: `nslookup cash.gutoapps.site`

## 📝 Comandos Úteis

```bash
# Parar todos os containers
docker-compose -f docker-compose.prod.yml stop

# Iniciar todos os containers
docker-compose -f docker-compose.prod.yml start

# Reiniciar todos os containers
docker-compose -f docker-compose.prod.yml restart

# Remover todos os containers (mantém volumes/dados)
docker-compose -f docker-compose.prod.yml down

# Remover tudo incluindo volumes (APAGA DADOS!)
docker-compose -f docker-compose.prod.yml down -v

# Acessar shell do container backend
docker exec -it cash_backend_prod sh

# Acessar MySQL
docker exec -it cash_db_prod mysql -u root -p
```

# Deploy CASH no Easypanel - Guia Passo a Passo

## 📋 Visão Geral

Você já tem o Easypanel configurado em `cash.gutoapps.site`. Vamos configurar a aplicação CASH usando a interface do Easypanel.

## Passo 1: Preparar Repositório Git

### Opção A: Criar repositório no GitHub (Recomendado)

1. Acesse [GitHub](https://github.com) e faça login
2. Clique em "New Repository"
3. Nome: `cash-app` (ou outro nome de sua preferência)
4. Pode ser **Privado** ou **Público**
5. **NÃO** inicialize com README
6. Clique em "Create repository"

### Opção B: Usar repositório existente

Se já tiver um repositório, pule para o Passo 2.

## Passo 2: Enviar Código para o GitHub

Abra o terminal/PowerShell na pasta do projeto e execute:

```powershell
# Se ainda não inicializou o Git
git init

# Adicionar todos os arquivos
git add .

# Fazer commit
git commit -m "Initial commit - CASH application"

# Conectar ao repositório remoto (substitua pela URL do seu repositório)
git remote add origin https://github.com/SEU_USUARIO/cash-app.git

# Enviar código
git branch -M main
git push -u origin main
```

**Se o repositório for PRIVADO**, você precisará de um token de acesso:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Marque "repo" scope
4. Copie o token gerado

## Passo 3: Criar Serviço de Banco de Dados no Easypanel

1. No Easypanel, vá em **"Projetos"** → **"dinheiro"**
2. Clique em **"+ Novo"** → **"MySQL"**
3. Configurações:
   - **Nome**: `cash-db`
   - **Versão**: `8.0` (ou latest)
   - **Root Password**: Anote a senha gerada (você vai precisar!)
   - **Database Name**: `cash_db`
4. Clique em **"Criar"**
5. **IMPORTANTE**: Anote o **Internal Host** (geralmente é `cash-db`)

## Passo 4: Criar Serviço da Aplicação no Easypanel

1. No projeto "dinheiro", clique em **"+ Novo"** → **"App"**
2. **Source (Origem)**:
   - **Git Provider**: GitHub
   - **Repository**: Selecione `seu-usuario/cash-app`
   - **Branch**: `main`
   - Se repositório privado, configure o token de acesso

3. **Build**:
   - **Build Method**: `Docker`
   - **Docker Context**: `/` (raiz)
   - **Dockerfile Path**: `Dockerfile` (Agora configurado para construir Frontend + Backend juntos no mesmo container)

4. **Environment Variables** (Variáveis de Ambiente):
   
   Clique em "Add Variable" e adicione cada uma dessas:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `DB_HOST` | `cash-db` (o Internal Host do MySQL) |
   | `DB_PORT` | `3306` |
   | `DB_USER` | `root` |
   | `DB_PASSWORD` | A senha do MySQL que você anotou |
   | `DB_NAME` | `cash_db` |
   | `JWT_SECRET` | Gere uma string aleatória longa (veja abaixo) |

   **Para gerar JWT_SECRET**, use um dos métodos:
   - Online: https://randomkeygen.com/ (CodeIgniter Encryption Keys)
   - PowerShell: `[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((1..64 | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 126) }) -join ''))`

5. **Domains (Domínios)**:
   - Clique em "Add Domain"
   - Digite: `cash.gutoapps.site`
   - Marque **"Enable HTTPS"** (SSL automático)

6. **Port Mapping**:
   - **Container Port**: `3000`
   - **Public Port**: `80` (HTTP) e `443` (HTTPS)

7. Clique em **"Deploy"** ou **"Save & Deploy"**

## Passo 5: Acompanhar o Deploy

1. Vá na aba **"Logs"** do serviço
2. Você verá:
   - Build da imagem Docker
   - "Waiting for Database..."
   - "Running Migrations..."
   - "🚀 Rocket CASH Backend API Server"

3. Aguarde até ver a mensagem de sucesso

## Passo 6: Verificar

1. Acesse `https://cash.gutoapps.site`
2. Você deve ver a tela de login da aplicação CASH
3. Teste criar uma conta e fazer login

## 🔧 Troubleshooting

### Erro: "Cannot connect to database"
- Verifique se o `DB_HOST` está correto (deve ser o nome do serviço MySQL)
- Verifique se a `DB_PASSWORD` está correta
- Verifique se o serviço MySQL está rodando

### Erro: "502 Bad Gateway"
- Aguarde alguns minutos (primeira inicialização demora devido às migrações)
- Verifique os logs do aplicativo
- Verifique se a `PORT` está configurada como `3000`

### Erro: "Build failed"
- Verifique se todos os arquivos foram enviados para o Git
- Verifique se o `Dockerfile` está na raiz do projeto
- Veja os logs de build para detalhes do erro

### SSL não está funcionando
- Aguarde alguns minutos (certificado leva tempo para ser emitido)
- Verifique se o domínio `cash.gutoapps.site` está apontando para o IP correto
- Tente forçar HTTPS nas configurações do domínio

## 📝 Próximos Passos Após Deploy

1. **Backup do Banco de Dados**: Configure backups automáticos no Easypanel
2. **Monitoramento**: Use as ferramentas de monitoramento do Easypanel
3. **Logs**: Monitore os logs regularmente para detectar erros

## ⚠️ Importante

- **Nunca** compartilhe suas senhas ou JWT_SECRET
- Guarde as credenciais em um local seguro
- Configure backups regulares do banco de dados
- Monitore o uso de recursos (CPU, memória, disco)

# Deploy no Easypanel

Este projeto está pronto para deploy no **Easypanel**. Siga os passos abaixo.

## 1. Pré-requisitos
- Um servidor com Easypanel instalado.
- Este repositório deve estar no GitHub/GitLab (ou outro git provider).

## 2. Criar Serviço de Banco de Dados
1. No seu projeto no Easypanel, clique em **"Create Service"**.
2. Escolha **"MySQL"**.
3. Defina o nome como `cash-db` (ou outro de sua preferência).
4. Anote a **Password** gerada (você vai precisar dela).
5. O _Internal Host_ será geralmente o nome do serviço (ex: `cash-db`).

## 3. Criar Serviço da Aplicação (App)
1. Clique em **"Create Service"** -> **"App"**.
2. **Source**:
   - Selecione o repositório Git do projeto.
   - Branch: `main` (ou a que você estiver usando).
   - **Build Method**: `Docker` (vai usar o `Dockerfile` da raiz).
   - **Docker Context**: `/` (raiz).
   - **Dockerfile Path**: `Dockerfile`.
   
3. **Environment Variables**:
   Adicione as seguintes variáveis de ambiente:
   
   | Key | Value | Descrição |
   |-----|-------|-----------|
   | `NODE_ENV` | `production` | Ambiente de produção |
   | `PORT` | `3000` | Porta interna (o Easypanel mapeia automaticamente) |
   | `DB_HOST` | `cash-db` | Nome do serviço do banco de dados (Host Interno) |
   | `DB_PORT` | `3306` | Porta padrão do MySQL |
   | `DB_USER` | `root` | Usuário padrão |
   | `DB_PASSWORD` | `******` | A senha que você anotou no passo 2 |
   | `DB_NAME` | `cash` | Nome do banco (será criado automaticamente se não existir) |
   | `JWT_SECRET` | `sua_chave_secreta` | Crie uma string longa e aleatória para segurança |
   
4. **Domains** (Opcional):
   - Configure o seu domínio (ex: `app.seudominio.com`) na aba "Domains".

## 4. Deploy
1. Clique em **"Deploy"** ou **"Save & Deploy"**.
2. Acompanhe os **Logs**.
   - O sistema vai construir a imagem Docker.
   - Ao iniciar, você verá logs de "Waiting for Database...", seguido de "Running Migrations...".
   - Finalmente: "Rocket CASH Backend API Server".

## 5. Troubleshooting (Resolução de Problemas)
- **Erro de conexão com banco**: Verifique se o `DB_HOST` está correto (nome do serviço no Easypanel) e a `DB_PASSWORD`.
- **Erro 502 Bad Gateway**: Aguarde alguns instantes. A primeira inicialização pode demorar devido às migrações. Verifique os logs se o erro persistir.

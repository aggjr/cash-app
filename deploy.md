# Guia de Deploy no Easypanel (Painel)

Este guia descreve como fazer o deploy da aplicação **CASH** no Easypanel (painel.gutoapps.site).

## Pré-requisitos
1.  Ter acesso ao painel do Easypanel.
2.  Ter o código fonte salvo em um repositório Git (GitHub/GitLab).
3.  Ter um banco de dados MySQL criado no Easypanel (Serviço de Banco de Dados).

## Estrutura do Projeto
O projeto está configurado para ser implantado como **dois serviços separados**:
1.  **Backend (API)**: Node.js
2.  **Frontend (App)**: React/Vite (Estático via Nginx)

## Passo 1: Configurar Backend (API)

1.  No Easypanel, crie um novo **Serviço** do tipo **App** (Source: GitHub).
2.  Selecione o repositório do projeto.
3.  **Configurações de Build**:
    *   **Root Directory (Context)**: `/backend` (ou `./backend`)
    *   **Dockerfile Path**: `Dockerfile` (O Easypanel buscará dentro da pasta backend)
4.  **Variáveis de Ambiente (Environment Variables)**:
    *   `DB_HOST`: (Host do serviço MySQL, geralmente o nome do serviço, ex: `mysql`)
    *   `DB_USER`: `root` (ou usuário criado)
    *   `DB_PASSWORD`: (Senha do banco)
    *   `DB_NAME`: `cash_db`
    *   `PORT`: `3001`
5.  **Domínio**: Configure o domínio da API (ex: `cash-api.gutoapps.site`) na aba "Domains" e aponte para a porta `3001`.
6.  Faça o deploy.

## Passo 2: Configurar Frontend (Aplicação)

1.  Crie outro **Serviço** do tipo **App** (GitHub).
2.  Selecione o mesmo repositório.
3.  **Configurações de Build**:
    *   **Root Directory (Context)**: `/` (Raiz)
    *   **Dockerfile Path**: `Dockerfile` (O Dockerfile na raiz constrói o frontend)
4.  **Variáveis de Ambiente**:
    *   `VITE_API_URL`: `https://cash-api.gutoapps.site` (A URL completa do seu backend configurado no passo anterior).
    *   *Nota*: Como o frontend é estático, essa variável deve estar disponível no momento do **BUILD**. Se o Easypanel não injetar no build, você pode precisar ajustar o Dockerfile ou hardcodar a URL no `vite.config.js` antes do commit se preferir.
5.  **Domínio**: Configure o domínio da aplicação (ex: `cash.gutoapps.site`) na aba "Domains" e aponte para a porta `80`.
6.  Faça o deploy.

## Passo 3: Resetar Banco de Dados (Primeiro Deploy)

Após o backend subir, conecte-se ao banco de dados (via PHPMyAdmin ou CLI do Easypanel) e execute o script `database/init.sql` para criar as tabelas.

## Resumo de Arquivos Importantes
*   `backend/Dockerfile`: Define como o Backend é construído.
*   `Dockerfile` (na raiz): Define como o Frontend é construído e servido (Nginx).
*   `nginx.conf` (na raiz): Configuração do servidor web do Frontend.

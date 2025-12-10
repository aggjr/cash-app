# Guia de Deploy - CASH System

Este guia descreve como colocar o sistema no ar usando Docker.

## Pré-requisitos do Servidor
- **Docker** e **Docker Compose** instalados.
- Acesso à internet para baixar as imagens (Node, Nginx, MySQL).
- Portas liberadas: `80` (HTTP) e `3307` (Opcional, para acesso direto ao banco).

## Passo a Passo

1. **Copiar Arquivos**
   Copie toda a pasta do projeto para o servidor (exceto `node_modules`).
   Certifique-se de que os seguintes arquivos estejam presentes:
   - `docker-compose.yml`
   - `Dockerfile` (na raiz)
   - `nginx.conf` (na raiz)
   - `backend/Dockerfile`
   - `backend/docker-entrypoint.js`
   - Código fonte (`src/`, `backend/`, `public/`, etc.)

2. **Configurar Senhas (Segurança)**
   Abra o arquivo `docker-compose.yml` e altere as seguintes variáveis:
   - `MYSQL_ROOT_PASSWORD`: Coloque uma senha forte.
   - `DB_PASSWORD` (no serviço backend): Coloque a **mesma** senha definida acima.
   - `JWT_SECRET`: Gere uma string aleatória longa para assinar os tokens.

3. **Iniciar o Sistema**
   Na pasta raiz do projeto no servidor, execute:
   ```bash
   docker-compose up -d --build
   ```
   *O parâmetro `--build` garante que as imagens sejam recriadas com o código mais recente.*

4. **Verificar Status**
   Para ver se tudo está rodando:
   ```bash
   docker-compose ps
   ```
   Para ver os logs (em caso de erro):
   ```bash
   docker-compose logs -f
   ```

## Notas Importantes
- **Dados do Banco**: Os dados ficam salvos em um volume Docker chamado `cash_mysql_data`. O container do banco pode ser reiniciado sem perda de dados.
- **Acesso**: O sistema estará acessível pelo IP do servidor na porta 80 (ex: `http://192.168.1.100`).
- **Migrações**: O backend executa automaticamente as migrações ao iniciar. Aguarde alguns segundos na primeira execução.

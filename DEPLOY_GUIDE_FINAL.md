# Guia Passo-a-Passo: Deploy Completo no Easypanel

Siga exatamente estes passos para configurar sua aplicação. Vamos criar **DOIS** serviços separados: um para a API (Backend) e outro para o Site (Frontend).

---

## 🛠️ Passo 1: Serviço da API (Backend)
Este serviço roda o "cérebro" do sistema e conecta no banco de dados.

1.  **Crie/Edite o serviço** (ex: `cash-api` ou `cash-app`).
2.  **Aba "General" / "Fonte"**:
    *   **Repository**: `aggjr/cash-app`
    *   **Branch**: `master`
    *   **Build Method**: `Docker`
    *   **Docker Context / Root Directory**: `/` (Raiz - deixe vazio ou barra)
    *   **Dockerfile Path**: `Dockerfile` (Deixe padrão)
3.  **Aba "Environment" / "Variáveis"** (Copie e cole):
    *   `PORT`: `3001`
    *   `DB_HOST`: `cash_cash-db` (Nome exato do seu serviço MySQL no painel)
    *   `DB_USER`: `root`
    *   `DB_PASSWORD`: (Sua senha do MySQL)
    *   `DB_NAME`: `cash_db`
    *   `JWT_SECRET`: (Uma senha longa e aleatória qualquer)
4.  **Aba "Domains"**:
    *   Adicione: `cash-api.gutoapps.site`
    *   Porta: `3001`
    *   HTTPS: Ativado
5.  **Ação**: Clique em **"Deploy"** (ou "Save & Deploy").

✅ **Resultado**: Após alguns minutos, acesse `https://cash-api.gutoapps.site/health`. Se aparecer `{"status":"ok"}`, a API está online!

---

## 🌐 Passo 2: Serviço do Site (Frontend)
Este serviço roda a "cara" do sistema que você acessa.

1.  **Crie um NOVO serviço** do tipo **App**.
2.  Nome: `cash-web` (ou `cash-frontend`).
3.  **Aba "General" / "Fonte"**:
    *   **Repository**: `aggjr/cash-app`
    *   **Branch**: `master`
    *   **Build Method**: `Docker`
    *   **Docker Context / Root Directory**: `/` (Raiz - deixe vazio ou barra)
    *   **Dockerfile Path**: `Dockerfile.frontend`  <-- **MUITO IMPORTANTE! Escreva exatamente isso.**
4.  **Aba "Environment" / "Variáveis"**:
    *   `VITE_API_URL`: `https://cash-api.gutoapps.site` (O domínio que você criou no Passo 1)
5.  **Aba "Domains"**:
    *   Adicione: `cash.gutoapps.site`
    *   Porta: `80`
    *   HTTPS: Ativado
6.  **Ação**: Clique em **"Deploy"**.

✅ **Resultado**: Acesse `https://cash.gutoapps.site`. O site deve abrir e conseguir fazer login!

---

## 🧹 Reset do Banco de Dados
Como configuramos o reset automático para este deploy:
1.  Assim que a API (Passo 1) iniciar com sucesso, ela vai **apagar e recriar** todo o banco de dados.
2.  O sistema estará zerado, pronto para uso.

**⚠️ Importante**: Após verificar que tudo funcionou, me avise para eu remover o comando de reset automático, senão ele vai zerar o banco toda vez que reiniciar.

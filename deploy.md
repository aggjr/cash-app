# Guia de Deploy Corrigido (Easypanel)

## Correção Importante: Separação de Serviços
Detectamos que o serviço `cash-app` estava configurado para a API mas tentando rodar o Frontend.
Fizemos uma alteração para simplificar:

*   **Arquivo `Dockerfile` (na raiz)**: Agora constrói o **Backend (API)**.
*   **Arquivo `Dockerfile.frontend` (na raiz)**: Agora constrói o **Frontend (App)**.

---

## Passo 1: Serviço da API (Backend)
Este é o serviço `cash-app` que você já tem (ou `cash-api`).

1.  **Configurações**:
    *   **Root Directory**: `/` (Raiz)
    *   **Dockerfile**: `Dockerfile` (padrão)
    *   **Variáveis**: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT` (padrão 3000), `JWT_SECRET`.
2.  **Ação**: Apenas faça o **Deploy** (ou Rebuild) deste serviço.
    *   *Nota*: Ele vai resetar o banco de dados automaticamente na primeira vez.

## Passo 2: Serviço do App (Frontend)
Você precisa criar um **segundo serviço** para a interface do usuário.

1.  Crie um Novo Serviço tipo **App** (GitHub).
2.  Nome: `cash-web` (ou outro de sua preferência).
3.  **Configurações**:
    *   **Root Directory**: `/` (Raiz)
    *   **Dockerfile**: `Dockerfile.frontend` (**IMPORTANTE**: Digite este nome no campo "Dockerfile Path")
4.  **Domínio**: Adicione seu domínio (ex: `cash.gutoapps.site`) e ative HTTPS.
5.  **Variáveis**: Não precisa de nenhuma obrigatória, a menos que queira mudar a URL da API (padrão é relativa ou hardcoded).
    *   Se precisar apontar para a API: `VITE_API_URL=https://nome-do-servico-api.gutoapps.site` (mas requer rebuild).

## Resumo
*   **Serviço 1 (Com Banco)**: Usa `Dockerfile` -> Roda Backend.
*   **Serviço 2 (Site)**: Usa `Dockerfile.frontend` -> Roda Frontend.

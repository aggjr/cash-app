# Atualização Completa no Easypanel (Baseline v1.0)

Este guia ajuda você a atualizar **completamente** o sistema no Easypanel para a versão estável _Baseline v1.0_.

## 1. Atualizar Aplicação (Código)

O Easypanel busca o código direto do GitHub. Como já criamos a Tag `v1.0-baseline` e atualizamos a branch `master`:

1. Acesse o **Easypanel**.
2. Vá no serviço da Aplicação (**App**).
3. Clique no botão **"Implantar"** (Verde) ou, preferencialmente, no **ícone de Martelo** (🔨 "Forçar Reconstrução").
   - O "Martelo" é garantido pois limpa o cache e baixa a versão mais recente.
4. Aguarde o status ficar verde ("Running").

## 2. Substituir Banco de Dados (Restructure)

⚠️ **ATENÇÃO**: Isso apagará todos os dados atuais do banco de produção e substituirá pelos dados do seu backup local (`baseline_stable_v1_20251219.sql`).

### Opção A: Script Automático (Recomendado)
Se você tem acesso externo ao banco de dados (Host e Porta liberados), rode o script que preparei:

1. Abra o Terminal no VS Code (Powershell).
2. Execute:
   ```powershell
   cd 'G:\Meu Drive\01 - Nova Estrutura\Trabalhos\FOCCUS\Programas\CASH\scripts'
   .\restore_db_remote.ps1
   ```
3. Digite as credenciais quando solicitado (Host, Usuário, Senha, Nome do Banco).

### Opção B: Manual (via PHPMyAdmin ou Shell)
Se não tiver acesso direto via script:

1. Vá no Easypanel > Serviço de Banco de Dados.
2. Abra o **PHPMyAdmin** (se instalado) ou use a linha de comando do Easypanel.
3. Importe o arquivo:
   `G:\Meu Drive\01 - Nova Estrutura\Trabalhos\FOCCUS\Programas\CASH\database\backups\baseline_stable_v1_20251219.sql`

---
**Após finalizar, seu sistema estará 100% sincronizado com a Baseline v1.0.**

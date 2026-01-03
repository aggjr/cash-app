# 🚀 Guia Rápido - Rodar a Aplicação CASH

## Passo 1: Configurar o Banco de Dados

1. **Abra o prompt de comando** e navegue até a pasta do projeto:
   ```
   cd c:\Users\Augusto\.gemini\antigravity\scratch\luminous-web\database
   ```

2. **Execute o script de setup**:
   ```
   setup-db.bat
   ```

3. **Digite sua senha do MySQL** quando solicitado

## Passo 2: Configurar a Senha do MySQL no Backend

1. **Abra o arquivo** `backend\.env` em um editor de texto

2. **Altere a linha**:
   ```
   DB_PASSWORD=your_password_here
   ```
   
   Para sua senha real do MySQL, por exemplo:
   ```
   DB_PASSWORD=minhasenha123
   ```

3. **Salve o arquivo**

## Passo 3: Iniciar o Backend

1. **Abra um novo terminal** (PowerShell ou CMD)

2. **Navegue até a pasta backend**:
   ```
   cd c:\Users\Augusto\.gemini\antigravity\scratch\luminous-web\backend
   ```

3. **Inicie o servidor backend**:
   ```
   npm run dev
   ```

4. **Verifique** se aparece a mensagem:
   ```
   ✓ Database connected successfully
   🚀 CASH Backend API Server
   📡 Server running on: http://localhost:3001
   ```

## Passo 4: Iniciar o Frontend

1. **Abra OUTRO terminal** (deixe o backend rodando)

2. **Navegue até a pasta principal**:
   ```
   cd c:\Users\Augusto\.gemini\antigravity\scratch\luminous-web
   ```

3. **Inicie o frontend** (já está rodando, mas se precisar reiniciar):
   ```
   npm run dev
   ```

## Passo 5: Acessar a Aplicação

1. **Abra o navegador** em: http://localhost:5173

2. **Clique em "Cadastros"** no menu lateral

3. **Clique em "Tipo Entrada"**

4. **Teste as funcionalidades**:
   - ✅ Criar nova categoria
   - ✅ Editar categoria
   - ✅ Excluir categoria
   - ✅ Arrastar e soltar
   - ✅ Usar setas para mover (⬅️ ➡️)

## ✅ Verificar se Está Funcionando

### Backend:
- Abra: http://localhost:3001/health
- Deve mostrar: `{"status":"OK","message":"CASH Backend API is running"}`

### API:
- Abra: http://localhost:3001/api/tipo-entrada
- Deve mostrar: Array JSON com os dados

### Frontend:
- Abra: http://localhost:5173
- Menu lateral deve aparecer
- Ao clicar em "Tipo Entrada", deve carregar os dados do banco

## 🔧 Solução de Problemas

### "Database connection failed"
- ✅ Verifique se o MySQL está rodando
- ✅ Confira a senha em `backend\.env`
- ✅ Teste conectar ao MySQL manualmente

### "Port 3001 already in use"
- ✅ Feche outros processos usando a porta 3001
- ✅ Ou altere a porta em `backend\.env`

### "Cannot find module"
- ✅ Execute `npm install` na pasta backend
- ✅ Execute `npm install` na pasta principal

## 📝 Comandos Úteis

```bash
# Ver processos na porta 3001
netstat -ano | findstr :3001

# Matar processo (substitua PID)
taskkill /PID <numero> /F

# Reinstalar dependências
cd backend
rm -rf node_modules
npm install
```

# 🔐 CASH - Credenciais para Easypanel

## ✅ Repositório GitHub
```
https://github.com/aggjr/cash-app.git
Branch: master
```

---

## 📝 Variáveis de Ambiente para o App

Copie e cole estas variáveis no Easypanel (seção Environment Variables):

### 1. NODE_ENV
```
production
```

### 2. PORT
```
3000
```

### 3. DB_HOST
```
cash-db
```
**IMPORTANTE**: Este deve ser exatamente o nome do serviço MySQL que você criar!

### 4. DB_PORT
```
3306
```

### 5. DB_USER
```
root
```

### 6. DB_PASSWORD
```
[COLE AQUI A SENHA DO MYSQL QUE O EASYPANEL GEROU]
```
**ATENÇÃO**: Você vai obter esta senha quando criar o serviço MySQL no Easypanel!

### 7. DB_NAME
```
cash_db
```

### 8. JWT_SECRET
```
NlBUZRLF2Ie50KWYzhXvtQx7D3qjbG4EdMmgsyoVASfi1rHpPn8Tu6kcOaw9CJ
```

---

## 🌐 Domínio
```
cash.gutoapps.site
```
✅ Marque "Enable HTTPS"

---

## 📋 Checklist de Configuração

### Passo 1: MySQL
- [ ] Criar serviço MySQL no Easypanel
- [ ] Nome: `cash-db`
- [ ] Database: `cash_db`
- [ ] Copiar a senha gerada

### Passo 2: Aplicação
- [ ] Criar serviço App no Easypanel
- [ ] Repositório: `aggjr/cash-app`
- [ ] Branch: `master`
- [ ] Build Method: `Docker`
- [ ] Dockerfile: `Dockerfile`

### Passo 3: Variáveis
- [ ] Adicionar todas as 8 variáveis acima
- [ ] Substituir `DB_PASSWORD` pela senha do MySQL
- [ ] Verificar que `DB_HOST` = `cash-db`

### Passo 4: Domínio
- [ ] Adicionar domínio `cash.gutoapps.site`
- [ ] Habilitar HTTPS

### Passo 5: Deploy
- [ ] Clicar em "Deploy"
- [ ] Aguardar build (2-5 minutos)
- [ ] Verificar logs

### Passo 6: Teste
- [ ] Acessar https://cash.gutoapps.site
- [ ] Testar login/registro

---

## 🎯 Resumo Rápido

1. **MySQL**: Criar serviço `cash-db` com database `cash_db`
2. **App**: Conectar ao GitHub `aggjr/cash-app` branch `master`
3. **Env Vars**: Copiar as 8 variáveis acima (substituir DB_PASSWORD)
4. **Domain**: `cash.gutoapps.site` com HTTPS
5. **Deploy**: Clicar e aguardar

---

**Dúvidas? Consulte o arquivo `EASYPANEL_SETUP.md` para instruções detalhadas!**

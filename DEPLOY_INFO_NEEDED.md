# 🚀 Deploy Helper - Informações Necessárias

Para fazer o deploy no servidor `cash.gutoapps.site`, preciso das seguintes informações:

## 1. Acesso SSH ao Servidor

```bash
# Exemplo de conexão SSH
ssh usuario@IP_DO_SERVIDOR
# ou
ssh usuario@cash.gutoapps.site
```

**Informações necessárias:**
- [ ] IP do servidor ou hostname
- [ ] Usuário SSH (ex: root, ubuntu, admin)
- [ ] Senha SSH ou caminho da chave privada

## 2. Configuração do Servidor

- [ ] Docker está instalado? (sim/não)
- [ ] Docker Compose está instalado? (sim/não)
- [ ] Diretório para a aplicação (ex: `/home/usuario/cash-app` ou `/var/www/cash`)

## 3. Credenciais para Produção

Preciso gerar senhas fortes para:
- **DB_PASSWORD**: Senha do banco de dados MySQL
- **JWT_SECRET**: Chave secreta para tokens JWT

**Opções:**
- [ ] Gerar automaticamente (recomendado)
- [ ] Você fornecerá as senhas

## 4. Configuração SSL

- [ ] Email para certificado Let's Encrypt (ex: seu-email@example.com)

## 5. Estado Atual

- [ ] Já existe algo rodando no servidor?
- [ ] Preciso parar/remover containers existentes?
- [ ] Já existe um banco de dados com dados que precisam ser preservados?

---

## Como Fornecer as Informações

Por favor, responda no seguinte formato:

```
SSH:
- IP: 123.456.789.0 (ou cash.gutoapps.site)
- Usuário: ubuntu
- Senha: minha_senha (ou caminho da chave: C:\Users\...\chave.pem)

Servidor:
- Docker instalado: sim
- Diretório: /home/ubuntu/cash-app

Senhas:
- Gerar automaticamente: sim

SSL:
- Email: augusto@example.com

Estado:
- Servidor limpo (nada rodando)
```

---

## Próximos Passos Após Receber as Informações

1. ✅ Conectar ao servidor via SSH
2. ✅ Transferir arquivos do projeto
3. ✅ Configurar variáveis de ambiente (.env.production)
4. ✅ Executar deploy (docker-compose up)
5. ✅ Verificar SSL e aplicação funcionando
6. ✅ Corrigir qualquer erro encontrado

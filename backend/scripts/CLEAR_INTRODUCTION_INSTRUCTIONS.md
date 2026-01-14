# Script para Limpar Introdução Hardcoded do Qdrant

## Problema
A IVA está usando uma apresentação hardcoded que foi gravada no Qdrant durante o seed inicial.

## Solução
Execute este comando no terminal (PowerShell ou CMD):

```powershell
# Opção 1: Usando curl (se disponível)
curl -X DELETE http://localhost:3001/api/iva/clear-introduction `
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Opção 2: Usando Invoke-WebRequest (PowerShell)
$token = "SEU_TOKEN_AQUI"
$headers = @{
    "Authorization" = "Bearer $token"
}
Invoke-WebRequest -Uri "http://localhost:3001/api/iva/clear-introduction" `
  -Method DELETE `
  -Headers $headers
```

## Como obter o token:

1. Abra o navegador
2. Pressione F12 (DevTools)
3. Vá na aba "Console"
4. Digite: `localStorage.getItem('token')`
5. Copie o token (sem as aspas)

## Alternativa: Executar direto no Node.js

Se o comando acima não funcionar, execute este código JavaScript no backend:

```javascript
// Abra o terminal na pasta backend e execute: node
// Depois cole este código:

const https = require('https');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/qdrant/points/scroll',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const data = JSON.stringify({
  filter: { category: 'introduction' },
  limit: 10
});

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const result = JSON.parse(body);
    console.log('Found points:', result.points?.length || 0);
    // Depois delete manualmente os IDs retornados
  });
});

req.write(data);
req.end();
```

## Verificação

Após executar, teste a IVA novamente. Ela deve gerar uma saudação dinâmica baseada no contexto!

# Script PowerShell para finalizar integração do prompt dinâmico

$filePath = "backend\services\IvaContextBuilderQdrant.js"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Encontrar onde o template hardcoded começa (após "return `")
# e onde termina (antes do final da função)

# Como esse é muito complexo para regex, vamos pegar as primeiras 87 linhas
# e adicionar apenas o fechamento do template lá

$lines = Get-Content $filePath -Encoding UTF8

# Pegar linhas 1-73 (antes do return `)
$beforeReturn = $lines[0..72]

# Nova linha de retorno
$newReturn = @"
   return ``
Você é `${systemInfo.assistant_name}, `${systemInfo.description}.

PERSONALIDADE (de Qdrant):
- Tom: `${personality.tone}
- Estilo: `${personality.style}
- Traços: `${personality.traits.join(', ')}

CONTEXTO TEMPORAL E ACESSO (CRÍTICO):
- Data/Hora Atual: `${isoDate}
- Data Último Acesso: `${lastAccess || 'Nenhum registro anterior'}
- Último acesso foi hoje? `${wasGreetedToday(lastAccess) ? 'SIM' : 'NÃO'}

`${systemPrompt}
``;
}

module.exports = {
   buildOperateContextWithQdrant
};
"@

# Juntar tudo
$fullContent = ($beforeReturn -join "`r`n") + "`r`n" + $newReturn

# Salvar
$fullContent | Out-File $filePath -Encoding UTF8 -NoNewline

Write-Host "✅ Arquivo modificado com sucesso!"
Write-Host "Prompt agora é carregado de backend/prompts/system.txt"

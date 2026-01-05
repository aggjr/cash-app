# Update all validateDateWithinRange calls to include req.user.role
$files = @(
    "backend/controllers/incomeController.js",
    "backend/controllers/saidaController.js",
    "backend/controllers/producaoRevendaController.js",
    "backend/controllers/aporteController.js"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    
    # Pattern 1: validateDateWithinRange(date, projectId)
    $content = $content -replace 'validateDateWithinRange\(([^,]+),\s*([^)]+)\)', 'validateDateWithinRange($1, $2, req.user.role)'
    
    Set-Content $file -Value $content -NoNewline
    Write-Host "Updated $file"
}

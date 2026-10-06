/**
 * Imports the supplier registry from the legacy ERP (FOCCUS) staging database into CASH.
 *
 * The staging database already holds a proper supplier registry in `saron_stg_suppliers`,
 * so this script only reads names and CNPJs from there and creates the missing ones in CASH.
 *
 * It writes through the CASH API rather than connecting to the production database, because
 * the production host only exposes HTTP. The account used must be a master of the project.
 *
 * It is idempotent: suppliers already present in CASH are matched by normalized name and left
 * untouched, so CNPJ, contact and notes typed in CASH are never overwritten.
 *
 * Nothing is written unless you pass --commit.
 *
 * Usage:
 *   node backend/scripts/import_fornecedores_legado.js --project 14
 *   node backend/scripts/import_fornecedores_legado.js --project 14 --commit
 *
 * Legacy staging connection (required):
 *   LEGACY_DB_HOST, LEGACY_DB_USER, LEGACY_DB_PASSWORD, LEGACY_DB_DATABASE
 *   LEGACY_DB_PORT              optional, default 3306
 *   LEGACY_FORNECEDORES_TABLE   optional, default saron_stg_suppliers
 *
 * CASH target (required):
 *   CASH_API_URL                e.g. https://cash.gutoapps.site/api
 *   CASH_EMAIL, CASH_PASSWORD   master account of the project
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const parseArgs = () => {
    const args = process.argv.slice(2);
    const result = { commit: false, projectId: null, limit: null };

    for (let i = 0; i < args.length; i += 1) {
        if (args[i] === '--commit') result.commit = true;
        else if (args[i] === '--project') result.projectId = parseInt(args[++i]);
        else if (args[i] === '--limit') result.limit = parseInt(args[++i]);
    }

    return result;
};

const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

/** Rejects anything that is not a plain identifier, since it goes straight into SQL. */
const safeIdentifier = (value) => {
    const name = String(value ?? '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
        console.error(`❌ Nome de tabela inválido: "${name}"`);
        process.exit(1);
    }
    return `\`${name}\``;
};

/** The legacy CNPJ column is free text ("0", "x", dots, commas). Keep only real ones. */
const cleanCnpj = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length === 14 ? digits : null;
};

const requireEnv = (names) => {
    const missing = names.filter((n) => !process.env[n]);
    if (missing.length > 0) {
        console.error(`❌ Variáveis de ambiente faltando: ${missing.join(', ')}`);
        process.exit(1);
    }
};

const api = async (path, { method = 'GET', token, body } = {}) => {
    const base = process.env.CASH_API_URL.replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 200)}`);
    }
    return text ? JSON.parse(text) : null;
};

const run = async () => {
    const { commit, projectId, limit } = parseArgs();

    if (!projectId) {
        console.error('❌ Informe o projeto de destino: --project <id>');
        process.exit(1);
    }

    requireEnv([
        'LEGACY_DB_HOST', 'LEGACY_DB_USER', 'LEGACY_DB_PASSWORD', 'LEGACY_DB_DATABASE',
        'CASH_API_URL', 'CASH_EMAIL', 'CASH_PASSWORD'
    ]);

    const table = safeIdentifier(process.env.LEGACY_FORNECEDORES_TABLE || 'saron_stg_suppliers');

    const legacy = await mysql.createConnection({
        host: process.env.LEGACY_DB_HOST,
        port: parseInt(process.env.LEGACY_DB_PORT || '3306'),
        user: process.env.LEGACY_DB_USER,
        password: process.env.LEGACY_DB_PASSWORD,
        database: process.env.LEGACY_DB_DATABASE,
        charset: 'utf8mb4'
    });

    try {
        console.log(`\n🔎 Lendo ${process.env.LEGACY_FORNECEDORES_TABLE || 'saron_stg_suppliers'} do legado...`);

        const [rows] = await legacy.query(
            `SELECT name, cnpj, is_own_supplier
             FROM ${table}
             WHERE is_deleted = 0 AND name IS NOT NULL AND TRIM(name) <> ''
             ORDER BY name`
        );

        // The legacy table repeats a supplier once per ERP record, so collapse by name.
        // The first non-empty CNPJ wins; the rest of the duplicates add nothing.
        const porNome = new Map();
        for (const row of rows) {
            const chave = normalize(row.name);
            if (!chave) continue;
            const atual = porNome.get(chave);
            if (!atual) {
                porNome.set(chave, {
                    name: String(row.name).trim(),
                    cnpj: cleanCnpj(row.cnpj),
                    proprio: row.is_own_supplier === 1
                });
            } else if (!atual.cnpj) {
                atual.cnpj = cleanCnpj(row.cnpj);
            }
        }

        const candidatos = [...porNome.values()];
        console.log(`   ${rows.length} registros no legado -> ${candidatos.length} fornecedores distintos`);

        console.log('\n🔐 Autenticando na API do CASH...');
        const auth = await api('/auth/login', {
            method: 'POST',
            body: { email: process.env.CASH_EMAIL, projectId, password: process.env.CASH_PASSWORD }
        });
        console.log(`   Projeto: ${auth.project?.name} (id ${auth.project?.id})`);

        const existentes = await api(`/fornecedores?projectId=${projectId}`, { token: auth.token });
        const jaExiste = new Set(existentes.map((f) => normalize(f.name)));
        console.log(`   ${existentes.length} fornecedor(es) já cadastrado(s) no CASH`);

        let novos = candidatos.filter((c) => !jaExiste.has(normalize(c.name)));
        if (limit) novos = novos.slice(0, limit);

        const semCnpj = novos.filter((c) => !c.cnpj).length;

        console.log('\n📋 Resumo');
        console.log(`   A criar .............. ${novos.length}`);
        console.log(`   Já no CASH ........... ${candidatos.filter((c) => jaExiste.has(normalize(c.name))).length}`);
        console.log(`   Sem CNPJ válido ...... ${semCnpj} (campo fica vazio, o nome é o que importa)`);

        const proprios = novos.filter((c) => c.proprio);
        if (proprios.length > 0) {
            console.log(`   ⚠️  Marcados no legado como empresa própria: ${proprios.map((p) => p.name).join(', ')}`);
        }

        console.log('\n   Fornecedores a criar:');
        novos.forEach((c) => console.log(`     - ${c.name}${c.cnpj ? ` (${c.cnpj})` : ''}`));

        if (!commit) {
            console.log('\n🔍 SIMULAÇÃO: nada foi gravado. Rode de novo com --commit para aplicar.\n');
            return;
        }

        console.log('\n💾 Gravando no CASH...');
        let criados = 0;
        const falhas = [];

        for (const c of novos) {
            try {
                await api('/fornecedores', {
                    method: 'POST',
                    token: auth.token,
                    body: {
                        name: c.name,
                        cnpj: c.cnpj,
                        observacoes: 'Importado do sistema legado',
                        projectId
                    }
                });
                criados += 1;
            } catch (error) {
                falhas.push({ name: c.name, error: error.message });
            }
        }

        console.log(`\n✅ ${criados} fornecedor(es) criado(s).`);
        if (falhas.length > 0) {
            console.log(`❌ ${falhas.length} falha(s):`);
            falhas.forEach((f) => console.log(`     - ${f.name}: ${f.error}`));
        }
        console.log('');
    } finally {
        await legacy.end();
    }
};

run().catch((error) => {
    console.error('❌ Erro na importação:', error.message);
    process.exit(1);
});

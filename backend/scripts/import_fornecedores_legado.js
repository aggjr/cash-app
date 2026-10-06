/**
 * Imports the supplier registry from the legacy system's database into `fornecedores`.
 *
 * Reads from the legacy database with a SELECT you provide, and writes into the CASH
 * database of a given project. It is idempotent: suppliers already present are matched
 * by CNPJ (digits only) or by normalized name, and only their EMPTY fields get filled,
 * so anything typed in CASH is never overwritten.
 *
 * Nothing is written unless you pass --commit.
 *
 * Usage:
 *   node backend/scripts/import_fornecedores_legado.js --project 1
 *   node backend/scripts/import_fornecedores_legado.js --project 1 --commit
 *
 * Required environment variables:
 *   LEGACY_DB_HOST, LEGACY_DB_USER, LEGACY_DB_PASSWORD, LEGACY_DB_DATABASE
 *   LEGACY_DB_PORT                 (optional, default 3306)
 *
 * Then pick ONE of the two ways to say where the suppliers are:
 *
 * A) Suppliers live in columns of the products table (the usual case here: one main
 *    supplier column plus the secondary ones). The script collects the distinct names
 *    across all listed columns:
 *
 *      LEGACY_PRODUTOS_TABLE=produtos
 *      LEGACY_FORNECEDOR_COLUNAS=fornecedor_principal,fornecedor_sec1,fornecedor_sec2
 *
 * B) Any other shape, via a free SELECT aliased to name (required), cnpj, contato,
 *    telefone, email, observacoes:
 *
 *      LEGACY_FORNECEDORES_QUERY="SELECT razao_social AS name, cnpj FROM cad_fornecedor"
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const db = require('../config/database');

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

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');

const normalizeName = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const clean = (value) => {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
};

const FIELDS = ['cnpj', 'contato', 'telefone', 'email', 'observacoes'];

/** Rejects anything that is not a plain identifier, since these go straight into SQL. */
const safeIdentifier = (value) => {
    const name = String(value ?? '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
        console.error(`❌ Nome de tabela/coluna inválido: "${name}"`);
        process.exit(1);
    }
    return `\`${name}\``;
};

/**
 * In the legacy system the suppliers are not a registry: each product row carries its
 * main supplier and the secondary ones in separate columns. This collects the distinct
 * names across all of those columns.
 */
const buildQuery = () => {
    if (process.env.LEGACY_FORNECEDORES_QUERY) {
        return process.env.LEGACY_FORNECEDORES_QUERY;
    }

    const table = process.env.LEGACY_PRODUTOS_TABLE;
    const colunas = (process.env.LEGACY_FORNECEDOR_COLUNAS || '')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

    if (!table || colunas.length === 0) return null;

    const safeTable = safeIdentifier(table);
    const selects = colunas.map(coluna => {
        const safeColuna = safeIdentifier(coluna);
        return `SELECT DISTINCT TRIM(${safeColuna}) AS name FROM ${safeTable}
                WHERE ${safeColuna} IS NOT NULL AND TRIM(${safeColuna}) <> ''`;
    });

    // UNION already removes the duplicates across columns.
    return selects.join('\nUNION\n');
};

async function main() {
    const { commit, projectId, limit } = parseArgs();

    if (!projectId) {
        console.error('❌ Informe o projeto de destino: --project <id>');
        process.exit(1);
    }

    const query = buildQuery();
    if (!query) {
        console.error('❌ Diga onde estão os fornecedores no legado, de uma destas formas:');
        console.error('   A) LEGACY_PRODUTOS_TABLE=produtos e LEGACY_FORNECEDOR_COLUNAS=col_principal,col_sec1,col_sec2');
        console.error('   B) LEGACY_FORNECEDORES_QUERY com um SELECT aliasado para name, cnpj, contato, telefone, email, observacoes');
        process.exit(1);
    }

    const missing = ['LEGACY_DB_HOST', 'LEGACY_DB_USER', 'LEGACY_DB_DATABASE']
        .filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error(`❌ Variáveis de ambiente faltando: ${missing.join(', ')}`);
        process.exit(1);
    }

    console.log(`\n${commit ? '🚚 IMPORTANDO' : '🔍 SIMULAÇÃO (use --commit para gravar)'} — projeto ${projectId}\n`);

    let legacy;
    try {
        legacy = await mysql.createConnection({
            host: process.env.LEGACY_DB_HOST,
            port: parseInt(process.env.LEGACY_DB_PORT) || 3306,
            user: process.env.LEGACY_DB_USER,
            password: process.env.LEGACY_DB_PASSWORD || '',
            database: process.env.LEGACY_DB_DATABASE
        });
    } catch (error) {
        console.error('❌ Não foi possível conectar no banco do legado:', error.message);
        process.exit(1);
    }

    const [legacyRows] = await legacy.query(query);
    await legacy.end();

    const rows = limit ? legacyRows.slice(0, limit) : legacyRows;
    console.log(`Legado retornou ${legacyRows.length} fornecedor(es).${limit ? ` Processando ${rows.length} (--limit).` : ''}`);

    const [existing] = await db.query(
        'SELECT id, name, cnpj, contato, telefone, email, observacoes FROM fornecedores WHERE project_id = ?',
        [projectId]
    );

    const byCnpj = new Map();
    const byName = new Map();
    for (const row of existing) {
        const cnpj = onlyDigits(row.cnpj);
        if (cnpj.length === 14) byCnpj.set(cnpj, row);
        byName.set(normalizeName(row.name), row);
    }

    const toInsert = [];
    const toUpdate = [];
    const skipped = [];
    const seen = new Set();

    for (const row of rows) {
        const name = clean(row.name);
        if (!name) {
            skipped.push({ reason: 'sem nome', row });
            continue;
        }

        const cnpjDigits = onlyDigits(row.cnpj);
        const key = cnpjDigits.length === 14 ? `cnpj:${cnpjDigits}` : `name:${normalizeName(name)}`;

        // The legacy export itself may repeat a supplier.
        if (seen.has(key)) {
            skipped.push({ reason: 'duplicado no legado', row });
            continue;
        }
        seen.add(key);

        const match = (cnpjDigits.length === 14 ? byCnpj.get(cnpjDigits) : null)
            || byName.get(normalizeName(name));

        const incoming = {
            name,
            cnpj: clean(row.cnpj),
            contato: clean(row.contato),
            telefone: clean(row.telefone),
            email: clean(row.email),
            observacoes: clean(row.observacoes)
        };

        if (!match) {
            toInsert.push(incoming);
            continue;
        }

        // Fill only what is empty in CASH, never overwrite what someone typed.
        const patch = {};
        for (const field of FIELDS) {
            if (!clean(match[field]) && incoming[field]) patch[field] = incoming[field];
        }

        if (Object.keys(patch).length > 0) {
            toUpdate.push({ id: match.id, name: match.name, patch });
        } else {
            skipped.push({ reason: 'já cadastrado e completo', row: incoming });
        }
    }

    console.log(`\n  Novos:        ${toInsert.length}`);
    console.log(`  Completados:  ${toUpdate.length}`);
    console.log(`  Ignorados:    ${skipped.length}`);

    if (toInsert.length > 0) {
        console.log('\n  Exemplos de novos fornecedores:');
        toInsert.slice(0, 10).forEach(f => console.log(`    • ${f.name}${f.cnpj ? ` (${f.cnpj})` : ''}`));
        if (toInsert.length > 10) console.log(`    ... e mais ${toInsert.length - 10}`);
    }

    if (toUpdate.length > 0) {
        console.log('\n  Exemplos de cadastros completados:');
        toUpdate.slice(0, 10).forEach(u => console.log(`    • ${u.name}: ${Object.keys(u.patch).join(', ')}`));
        if (toUpdate.length > 10) console.log(`    ... e mais ${toUpdate.length - 10}`);
    }

    if (!commit) {
        console.log('\n✅ Simulação concluída. Nada foi gravado. Rode de novo com --commit para aplicar.\n');
        process.exit(0);
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        for (const f of toInsert) {
            await connection.query(
                `INSERT INTO fornecedores (name, cnpj, contato, telefone, email, observacoes, project_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [f.name, f.cnpj, f.contato, f.telefone, f.email, f.observacoes, projectId]
            );
        }

        for (const u of toUpdate) {
            const sets = Object.keys(u.patch).map(field => `${field} = ?`);
            await connection.query(
                `UPDATE fornecedores SET ${sets.join(', ')} WHERE id = ?`,
                [...Object.values(u.patch), u.id]
            );
        }

        await connection.commit();
        console.log(`\n✅ Importação concluída: ${toInsert.length} criados, ${toUpdate.length} completados.\n`);
    } catch (error) {
        await connection.rollback();
        console.error('❌ Importação revertida por erro:', error.message);
        process.exitCode = 1;
    } finally {
        connection.release();
    }

    process.exit(process.exitCode || 0);
}

main().catch(error => {
    console.error('❌ Falha na importação:', error);
    process.exit(1);
});

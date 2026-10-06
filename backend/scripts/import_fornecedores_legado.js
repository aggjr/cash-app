/**
 * Imports suppliers from the legacy system's database.
 *
 * The legacy system has no supplier registry: each product row carries its main supplier
 * and the secondary ones in their own columns. This script therefore does two things:
 *
 *   1. Collects the distinct supplier names across those columns into `fornecedores`.
 *   2. Links each product to its suppliers in `produto_fornecedores`, keeping which one
 *      is the main supplier.
 *
 * It is idempotent. Suppliers already in CASH are matched by normalized name and left
 * untouched, so CNPJ, contact and notes typed in CASH are never overwritten. Links are
 * replaced only for the products that came in this import.
 *
 * Nothing is written unless you pass --commit.
 *
 * Usage:
 *   node backend/scripts/import_fornecedores_legado.js --project 1
 *   node backend/scripts/import_fornecedores_legado.js --project 1 --commit
 *
 * Connection (always required):
 *   LEGACY_DB_HOST, LEGACY_DB_USER, LEGACY_DB_PASSWORD, LEGACY_DB_DATABASE
 *   LEGACY_DB_PORT                          optional, default 3306
 *
 * Source — names AND product links (what the legacy system looks like):
 *   LEGACY_PRODUTOS_TABLE=produtos
 *   LEGACY_PRODUTO_NOME_COLUNA=descricao
 *   LEGACY_FORNECEDOR_PRINCIPAL_COLUNA=fornecedor_principal
 *   LEGACY_FORNECEDOR_SECUNDARIOS_COLUNAS=fornecedor_sec1,fornecedor_sec2
 *
 * Source — only the list of names, without linking to products:
 *   LEGACY_PRODUTOS_TABLE=produtos
 *   LEGACY_FORNECEDOR_COLUNAS=fornecedor_principal,fornecedor_sec1,fornecedor_sec2
 *   ...or a free SELECT whose rows expose a `name` column:
 *   LEGACY_FORNECEDORES_QUERY="SELECT DISTINCT razao_social AS name FROM cad_fornecedor"
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

const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const clean = (value) => {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
};

/** Rejects anything that is not a plain identifier, since these go straight into SQL. */
const safeIdentifier = (value) => {
    const name = String(value ?? '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
        console.error(`❌ Nome de tabela/coluna inválido: "${name}"`);
        process.exit(1);
    }
    return `\`${name}\``;
};

const splitColumns = (value) => String(value ?? '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

/** Decides what to read from the legacy database based on the environment. */
const resolveSource = () => {
    const table = process.env.LEGACY_PRODUTOS_TABLE;
    const nomeColuna = process.env.LEGACY_PRODUTO_NOME_COLUNA;
    const principalColuna = process.env.LEGACY_FORNECEDOR_PRINCIPAL_COLUNA;
    const secundariasColunas = splitColumns(process.env.LEGACY_FORNECEDOR_SECUNDARIOS_COLUNAS);

    if (table && nomeColuna && principalColuna) {
        const colunas = [principalColuna, ...secundariasColunas];
        const selects = [
            `${safeIdentifier(nomeColuna)} AS produto`,
            `${safeIdentifier(principalColuna)} AS principal`,
            ...secundariasColunas.map((c, i) => `${safeIdentifier(c)} AS secundario_${i}`)
        ];

        return {
            mode: 'links',
            colunas,
            secundariasCount: secundariasColunas.length,
            query: `SELECT ${selects.join(', ')} FROM ${safeIdentifier(table)}`
        };
    }

    if (process.env.LEGACY_FORNECEDORES_QUERY) {
        return { mode: 'names', query: process.env.LEGACY_FORNECEDORES_QUERY };
    }

    const colunas = splitColumns(process.env.LEGACY_FORNECEDOR_COLUNAS);
    if (table && colunas.length > 0) {
        const safeTable = safeIdentifier(table);
        // UNION already removes the duplicates across columns.
        const query = colunas.map(coluna => {
            const safeColuna = safeIdentifier(coluna);
            return `SELECT DISTINCT TRIM(${safeColuna}) AS name FROM ${safeTable}
                    WHERE ${safeColuna} IS NOT NULL AND TRIM(${safeColuna}) <> ''`;
        }).join('\nUNION\n');

        return { mode: 'names', query };
    }

    return null;
};

async function main() {
    const { commit, projectId, limit } = parseArgs();

    if (!projectId) {
        console.error('❌ Informe o projeto de destino: --project <id>');
        process.exit(1);
    }

    const source = resolveSource();
    if (!source) {
        console.error('❌ Diga onde estão os fornecedores no legado. Para trazer nomes e vínculos:');
        console.error('   LEGACY_PRODUTOS_TABLE, LEGACY_PRODUTO_NOME_COLUNA,');
        console.error('   LEGACY_FORNECEDOR_PRINCIPAL_COLUNA e LEGACY_FORNECEDOR_SECUNDARIOS_COLUNAS');
        console.error('   Para trazer só a lista de nomes: LEGACY_FORNECEDOR_COLUNAS ou LEGACY_FORNECEDORES_QUERY');
        process.exit(1);
    }

    const missing = ['LEGACY_DB_HOST', 'LEGACY_DB_USER', 'LEGACY_DB_DATABASE']
        .filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error(`❌ Variáveis de ambiente faltando: ${missing.join(', ')}`);
        process.exit(1);
    }

    console.log(`\n${commit ? '🚚 IMPORTANDO' : '🔍 SIMULAÇÃO (use --commit para gravar)'} — projeto ${projectId}`);
    console.log(`   Modo: ${source.mode === 'links' ? 'nomes + vínculo com produtos' : 'somente a lista de nomes'}\n`);

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

    let legacyRows;
    try {
        [legacyRows] = await legacy.query(source.query);
    } catch (error) {
        console.error('❌ A consulta ao legado falhou:', error.message);
        await legacy.end();
        process.exit(1);
    }
    await legacy.end();

    const rows = limit ? legacyRows.slice(0, limit) : legacyRows;
    console.log(`Legado retornou ${legacyRows.length} linha(s).${limit ? ` Processando ${rows.length} (--limit).` : ''}`);

    // ---------- 1) Supplier registry ----------

    const nomesLegado = new Map(); // normalized -> original spelling

    const registrarNome = (valor) => {
        const nome = clean(valor);
        if (!nome) return null;
        const chave = normalize(nome);
        if (!nomesLegado.has(chave)) nomesLegado.set(chave, nome);
        return chave;
    };

    const produtosLegado = [];

    for (const row of rows) {
        if (source.mode === 'names') {
            registrarNome(row.name);
            continue;
        }

        const produto = clean(row.produto);
        const principal = registrarNome(row.principal);
        const secundarios = [];
        for (let i = 0; i < source.secundariasCount; i += 1) {
            const chave = registrarNome(row[`secundario_${i}`]);
            if (chave && chave !== principal && !secundarios.includes(chave)) secundarios.push(chave);
        }

        if (produto && (principal || secundarios.length > 0)) {
            produtosLegado.push({ produto, principal, secundarios });
        }
    }

    const [existentes] = await db.query(
        'SELECT id, name FROM fornecedores WHERE project_id = ?',
        [projectId]
    );

    const porNome = new Map();
    for (const row of existentes) {
        porNome.set(normalize(row.name), row);
    }

    const aCriar = [];
    for (const [chave, nome] of nomesLegado) {
        if (!porNome.has(chave)) aCriar.push({ chave, name: nome });
    }

    console.log(`\n  Fornecedores distintos no legado: ${nomesLegado.size}`);
    console.log(`  Já existentes no CASH:            ${nomesLegado.size - aCriar.length}`);
    console.log(`  Novos a criar:                    ${aCriar.length}`);

    if (aCriar.length > 0) {
        console.log('\n  Exemplos de novos fornecedores:');
        aCriar.slice(0, 10).forEach(f => console.log(`    • ${f.name}`));
        if (aCriar.length > 10) console.log(`    ... e mais ${aCriar.length - 10}`);
    }

    // ---------- 2) Product links ----------

    let vinculos = [];
    let semCorrespondencia = [];

    if (source.mode === 'links') {
        const [tipos] = await db.query(
            'SELECT id, label FROM tipo_producao_revenda WHERE project_id = ? AND active = 1',
            [projectId]
        );

        const tipoPorLabel = new Map();
        for (const tipo of tipos) {
            // Ambiguous labels are skipped rather than linked to an arbitrary node.
            const chave = normalize(tipo.label);
            if (tipoPorLabel.has(chave)) tipoPorLabel.set(chave, 'AMBIGUO');
            else tipoPorLabel.set(chave, tipo.id);
        }

        const ambiguos = new Set();
        for (const item of produtosLegado) {
            const achado = tipoPorLabel.get(normalize(item.produto));
            if (achado === 'AMBIGUO') {
                ambiguos.add(item.produto);
                continue;
            }
            if (!achado) {
                semCorrespondencia.push(item.produto);
                continue;
            }
            vinculos.push({ tipoId: achado, produto: item.produto, principal: item.principal, secundarios: item.secundarios });
        }

        console.log(`\n  Produtos do legado com fornecedor: ${produtosLegado.length}`);
        console.log(`  Casados com a árvore do CASH:      ${vinculos.length}`);
        console.log(`  Sem correspondência no CASH:       ${semCorrespondencia.length}`);
        if (ambiguos.size > 0) console.log(`  Nome repetido na árvore (pulados): ${ambiguos.size}`);

        if (semCorrespondencia.length > 0) {
            console.log('\n  Produtos que não existem na árvore do CASH (nada será vinculado):');
            semCorrespondencia.slice(0, 15).forEach(p => console.log(`    • ${p}`));
            if (semCorrespondencia.length > 15) console.log(`    ... e mais ${semCorrespondencia.length - 15}`);
        }
        if (ambiguos.size > 0) {
            console.log('\n  Produtos com nome repetido na árvore (ajuste antes de vincular):');
            Array.from(ambiguos).slice(0, 10).forEach(p => console.log(`    • ${p}`));
        }
    }

    if (!commit) {
        console.log('\n✅ Simulação concluída. Nada foi gravado. Rode de novo com --commit para aplicar.\n');
        process.exit(0);
    }

    // ---------- 3) Write ----------

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        for (const f of aCriar) {
            const [result] = await connection.query(
                'INSERT INTO fornecedores (name, project_id) VALUES (?, ?)',
                [f.name, projectId]
            );
            porNome.set(f.chave, { id: result.insertId, name: f.name });
        }

        let linksCriados = 0;
        for (const vinculo of vinculos) {
            const entradas = [];

            const principalRow = vinculo.principal ? porNome.get(vinculo.principal) : null;
            if (principalRow) entradas.push({ id: principalRow.id, principal: 1 });

            for (const chave of vinculo.secundarios) {
                const row = porNome.get(chave);
                if (row && !entradas.some(e => e.id === row.id)) entradas.push({ id: row.id, principal: 0 });
            }

            if (entradas.length === 0) continue;
            // Without a main supplier in the legacy row, the first one takes that role.
            if (!entradas.some(e => e.principal)) entradas[0].principal = 1;

            await connection.query('DELETE FROM produto_fornecedores WHERE tipo_id = ?', [vinculo.tipoId]);
            for (const entrada of entradas) {
                await connection.query(
                    'INSERT INTO produto_fornecedores (tipo_id, fornecedor_id, principal) VALUES (?, ?, ?)',
                    [vinculo.tipoId, entrada.id, entrada.principal]
                );
                linksCriados += 1;
            }
        }

        await connection.commit();
        console.log(`\n✅ Importação concluída: ${aCriar.length} fornecedores criados, ${linksCriados} vínculo(s) em ${vinculos.length} produto(s).\n`);
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

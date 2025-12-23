const ExcelJS = require('exceljs');
const fs = require('fs');

/**
 * Test script to try different currency formats
 * This generates an Excel file with multiple columns, each using a different currency format
 */

async function testCurrencyFormats() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Currency Format Tester';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Teste de Formatos');

    // Test values (positive, negative, zero, decimal)
    const testValues = [
        100,
        1000,
        10000.50,
        -500.75,
        0,
        12345.67,
        -1234.56,
        999999.99
    ];

    // Different format patterns to test
    const formats = [
        { name: 'Formato 1: Simples (Atual)', pattern: 'R$ #,##0.00' },
        { name: 'Formato 2: Com Espaço', pattern: '"R$ "* #,##0.00' },
        { name: 'Formato 3: Accounting Básico', pattern: '_-"R$ "* #,##0.00_-;-"R$ "* #,##0.00_-;_-"R$ "* "-"_-;_-@_-' },
        { name: 'Formato 4: Sem Hífen Zero', pattern: '_-"R$ "* #,##0.00_-;-"R$ "* #,##0.00_-;_-"R$ "* 0.00_-;_-@_-' },
        { name: 'Formato 5: Com Red Negative', pattern: '"R$ "#,##0.00;[Red]"R$ "-#,##0.00;"R$ "-";"R$ "@"' },
        { name: 'Formato 6: Underline Style', pattern: '_ * #,##0.00" R$"_ ;_ * -#,##0.00" R$"_ ;_ * "-"" R$"_ ;_ @_ ' },
        { name: 'Formato 7: Currency ID', pattern: '[$$-416]#,##0.00' },
        { name: 'Formato 8: Br Format', pattern: 'R$#,##0.00_);(R$#,##0.00)' },
        { name: 'Formato 9: Space Align', pattern: '"R$" #,##0.00_);[Red]("R$" #,##0.00)' },
        { name: 'Formato 10: Accounting Alt', pattern: '_("R$"* #,##0.00_);_("R$"* (#,##0.00);_("R$"* "-"??_);_(@_)' },
        { name: 'Formato 11: Simple BRL', pattern: 'R$#,##0.00' },
        { name: 'Formato 12: With Thousands', pattern: '"R$ "#.##0,00' }
    ];

    // Create header row
    const headerRow = ['Valor'];
    formats.forEach(f => headerRow.push(f.name));
    sheet.addRow(headerRow);

    // Style header
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    header.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add test data rows
    testValues.forEach((value, idx) => {
        const rowData = [value];

        // Add the same value formatted with each pattern
        formats.forEach(() => rowData.push(value));

        const row = sheet.addRow(rowData);

        // Apply formats to each column
        formats.forEach((format, formatIdx) => {
            const cell = row.getCell(formatIdx + 2); // +2 because column 1 is the raw value
            cell.numFmt = format.pattern;
            cell.alignment = { vertical: 'middle', horizontal: 'right' };

            // Alternate row colors
            if (idx % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });

        // Style first column (raw value)
        row.getCell(1).numFmt = '#,##0.00';
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(1).font = { bold: true };
        if (idx % 2 === 0) {
            row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        }
    });

    // Set column widths
    sheet.getColumn(1).width = 15;
    formats.forEach((_, idx) => {
        sheet.getColumn(idx + 2).width = 25;
    });

    // Add instructions at the bottom
    sheet.addRow([]);
    const instructionRow = sheet.addRow(['INSTRUÇÕES: Abra este arquivo e veja qual coluna mostra os valores corretamente sem erros']);
    instructionRow.getCell(1).font = { italic: true, color: { argb: 'FF666666' } };

    const instructionRow2 = sheet.addRow(['Se alguma coluna mostrar ######## ou causar erro ao abrir, esse formato não funciona']);
    instructionRow2.getCell(1).font = { italic: true, color: { argb: 'FF666666' } };

    // Write file
    const buffer = await workbook.xlsx.writeBuffer();
    fs.writeFileSync('./teste_formatos_moeda.xlsx', buffer);

    console.log('✅ Arquivo criado: teste_formatos_moeda.xlsx');
    console.log('📊 Testando', formats.length, 'formatos diferentes');
    console.log('🔢 Com', testValues.length, 'valores de teste cada');
    console.log('\nAbra o arquivo e veja qual coluna funciona melhor!');
}

testCurrencyFormats().catch(console.error);

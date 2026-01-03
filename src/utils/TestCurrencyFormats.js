import ExcelJS from 'exceljs';

/**
 * Gera um arquivo Excel de teste com múltiplas colunas
 * Cada coluna usa um formato diferente de moeda
 */
export async function generateCurrencyFormatTest() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Currency Format Tester';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Teste de Formatos');

    // Valores de teste
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

    // Diferentes formatos para testar
    const formats = [
        { name: 'F1: Simples (Atual)', pattern: 'R$ #,##0.00' },
        { name: 'F2: Com Espaço', pattern: '"R$ "* #,##0.00' },
        { name: 'F3: Accounting Básico', pattern: '_-"R$ "* #,##0.00_-;-"R$ "* #,##0.00_-;_-"R$ "* "-"_-;_-@_-' },
        { name: 'F4: Sem Hífen Zero', pattern: '_-"R$ "* #,##0.00_-;-"R$ "* #,##0.00_-;_-"R$ "* 0.00_-;_-@_-' },
        { name: 'F5: Red Negative', pattern: '"R$ "#,##0.00;[Red]"R$ "-#,##0.00;"R$ "-";"R$ "@"' },
        { name: 'F6: Underline', pattern: '_ * #,##0.00" R$"_ ;_ * -#,##0.00" R$"_ ;_ * "-"" R$"_ ;_ @_ ' },
        { name: 'F7: Currency ID', pattern: '[$$-416]#,##0.00' },
        { name: 'F8: Br Format', pattern: 'R$#,##0.00_);(R$#,##0.00)' },
        { name: 'F9: Space Align', pattern: '"R$" #,##0.00_);[Red]("R$" #,##0.00)' },
        { name: 'F10: Accounting Alt', pattern: '_("R$"* #,##0.00_);_("R$"* (#,##0.00);_("R$"* "-"??_);_(@_)' },
        { name: 'F11: Simple BRL', pattern: 'R$#,##0.00' },
        { name: 'F12: Thousands', pattern: '"R$ "#.##0,00' }
    ];

    // Criar header
    const headerRow = ['Valor Original'];
    formats.forEach(f => headerRow.push(f.name));
    sheet.addRow(headerRow);

    // Estilizar header
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    header.alignment = { vertical: 'middle', horizontal: 'center' };
    header.height = 25;

    // Adicionar dados
    testValues.forEach((value, idx) => {
        const rowData = [value];
        formats.forEach(() => rowData.push(value));
        const row = sheet.addRow(rowData);

        // Aplicar formatos
        formats.forEach((format, formatIdx) => {
            const cell = row.getCell(formatIdx + 2);
            cell.numFmt = format.pattern;
            cell.alignment = { vertical: 'middle', horizontal: 'right' };

            // Cores alternadas
            if (idx % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });

        // Estilizar primeira coluna
        row.getCell(1).numFmt = '#,##0.00';
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(1).font = { bold: true };
        if (idx % 2 === 0) {
            row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        }
    });

    // Definir larguras
    sheet.getColumn(1).width = 18;
    formats.forEach((_, idx) => {
        sheet.getColumn(idx + 2).width = 20;
    });

    // Adicionar instruções
    sheet.addRow([]);
    const inst1 = sheet.addRow(['INSTRUÇÕES: Cada coluna (F1 a F12) usa um formato diferente']);
    inst1.getCell(1).font = { italic: true, color: { argb: 'FF666666' }, size: 11 };

    const inst2 = sheet.addRow(['Veja qual coluna NÃO mostra ######## e tem boa aparência']);
    inst2.getCell(1).font = { italic: true, color: { argb: 'FF666666' }, size: 11 };

    // Gerar arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Download
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'teste_formatos_moeda.xlsx';
    anchor.click();
    window.URL.revokeObjectURL(url);

    console.log('✅ Arquivo de teste gerado com', formats.length, 'formatos diferentes!');
}

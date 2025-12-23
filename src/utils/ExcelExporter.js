import ExcelJS from 'exceljs';

/**
 * Excel Exporter with Styling (ExcelJS)
 * Mimics the Generic Tree view styles but splits hierarchy into columns
 */
export const ExcelExporter = {

    /**
     * Exports tree data to formatted Excel
     * @param {Array} treeData - The hierarchical tree data
     * @param {string} title - Worksheet title
     * @param {string} fileName - Download filename
     */
    exportTree: async (treeData, title, fileName) => {
        // Defines
        const HEADER_FILL = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F172A' } // Dark slate
        };
        const HEADER_FONT = {
            name: 'Arial',
            color: { argb: 'FFFFFFFF' },
            bold: true,
            size: 11
        };

        const BORDER_STYLE = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        const ROW_COLOR_ROOT = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' } // Slate 50
        };
        const ROW_COLOR_CHILD = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // White
        };

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Cash App';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(title.substring(0, 31));

        // Define Columns: A=Tipo, B=Sub-tipo, C=Status
        sheet.columns = [
            { header: 'Tipo', key: 'type', width: 40 },
            { header: 'Sub-tipo', key: 'subtype', width: 40 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // 1. Style Header Row
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = HEADER_FILL;
            cell.font = HEADER_FONT;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = BORDER_STYLE;
        });

        // Add AutoFilter to headers
        sheet.autoFilter = {
            from: 'A1',
            to: 'C1',
        };

        // 2. Flatten Tree with Column Logic
        const processNode = (node, level = 0) => {
            const isRoot = level === 0;

            // Map data to columns based on level
            // Level 0 (Root) -> type column
            // Level 1 (Child) -> subtype column
            const rowData = {
                type: isRoot ? node.label : '',
                subtype: !isRoot ? node.label : '',
                status: node.active ? 'Ativo' : 'Inativo'
            };

            // Add Row
            const row = sheet.addRow(rowData);

            // Style Row
            const rowStyle = isRoot ? ROW_COLOR_ROOT : ROW_COLOR_CHILD;

            // Apply styles to all cells in row
            [1, 2, 3].forEach(colIdx => {
                const cell = row.getCell(colIdx);
                cell.fill = rowStyle;
                cell.border = BORDER_STYLE;

                // Font color logic
                cell.font = {
                    size: 11,
                    color: { argb: node.active ? 'FF1E293B' : 'FF94A3B8' }, // Dark or Muted
                    bold: isRoot && colIdx === 1 // Bold only Root Name
                };

                // Alignment
                if (colIdx === 3) { // Status
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.font.italic = true;
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            });

            // Recursion
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => processNode(child, level + 1));
            }
        };

        treeData.forEach(node => processNode(node));

        // 3. Write and Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${fileName}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    },

    /**
     * Exports flat table data to formatted Excel
     * @param {Array} data - Flat array of objects
     * @param {Array} columns - Column definitions [{ header, key, width, type }]
     * @param {string} title - Worksheet title
     * @param {string} fileName - Download filename
     */
    exportTable: async (data, columns, title, fileName) => {
        // Shared defines
        const HEADER_FILL = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F172A' } // Dark slate
        };
        const HEADER_FONT = {
            name: 'Arial',
            color: { argb: 'FFFFFFFF' },
            bold: true,
            size: 11
        };

        const BORDER_STYLE = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        const ROW_COLOR_ODD = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' } // Slate 50
        };
        const ROW_COLOR_EVEN = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // White
        };

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Cash App';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(title.substring(0, 31));

        // TEMPORARY TEST MODE: Add multiple currency format columns
        const TEST_MODE = true; // Set to false to disable
        const currencyFormats = TEST_MODE ? [
            { name: 'F1:Simples(Atual)', pattern: 'R$ #,##0.00' },
            { name: 'F2:ComEspaço', pattern: '"R$ "* #,##0.00' },
            { name: 'F3:Accounting', pattern: '_-"R$ "* #,##0.00_-;-"R$ "* #,##0.00_-;_-"R$ "* "-"_-;_-@_-' },
            { name: 'F4:SemHífenZero', pattern: '_-"R$ "* #,##0.00_-;-"R$ "* #,##0.00_-;_-"R$ "* 0.00_-;_-@_-' },
            { name: 'F5:RedNegative', pattern: '"R$ "#,##0.00;[Red]"R$ "-#,##0.00;"R$ "-";"R$ "@"' },
            { name: 'F6:Underline', pattern: '_ * #,##0.00" R$"_ ;_ * -#,##0.00" R$"_ ;_ * "-"" R$"_ ;_ @_ ' },
            { name: 'F7:CurrencyID', pattern: '[$$-416]#,##0.00' },
            { name: 'F8:BrFormat', pattern: 'R$#,##0.00_);(R$#,##0.00)' },
            { name: 'F9:SpaceAlign', pattern: '"R$" #,##0.00_);[Red]("R$" #,##0.00)' },
            { name: 'F10:AccAlt', pattern: '_("R$"* #,##0.00_);_("R$"* (#,##0.00);_("R$"* "-"??_);_(@_)' },
            { name: 'F11:SimpleBRL', pattern: 'R$#,##0.00' },
            { name: 'F12:Thousands', pattern: '"R$ "#.##0,00' }
        ] : [];

        // Define Columns - add test columns if in TEST_MODE
        const baseColumns = columns.map(c => ({
            header: c.header,
            key: c.key,
            width: c.width || 20
        }));

        if (TEST_MODE && columns.some(c => c.type === 'currency')) {
            // Find currency column to duplicate
            const currencyCol = columns.find(c => c.type === 'currency');
            if (currencyCol) {
                // Add test format columns after the original columns
                currencyFormats.forEach((fmt, idx) => {
                    baseColumns.push({
                        header: fmt.name,
                        key: `valor_test_${idx}`,
                        width: 18
                    });
                });
            }
        }

        sheet.columns = baseColumns;

        // 1. Style Header Row
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = HEADER_FILL;
            cell.font = HEADER_FONT;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = BORDER_STYLE;
        });

        // Add AutoFilter
        const lastColChar = String.fromCharCode(64 + columns.length); // Simple A-Z logic, sufficient for < 26 cols
        sheet.autoFilter = {
            from: 'A1',
            to: `${lastColChar}1`,
        };

        // 2. Add Data
        data.forEach((item, index) => {
            const rowData = {};
            columns.forEach(col => {
                let value = item[col.key];

                // Active status handling
                if (col.key === 'active' && typeof value === 'boolean') {
                    value = value ? 'Ativo' : 'Inativo';
                }
                // Date handling - convert ISO date to Date object
                else if (col.type === 'date' && value) {
                    // Parse ISO date string to Date object
                    const dateValue = new Date(value);
                    if (!isNaN(dateValue.getTime())) {
                        value = dateValue;
                    }
                }
                // Currency handling - ensure numeric value
                else if (col.type === 'currency' && value) {
                    value = parseFloat(value) || 0;
                }

                rowData[col.key] = value;
            });

            // TEST MODE: Add currency test columns
            if (TEST_MODE && currencyFormats.length > 0) {
                const currencyCol = columns.find(c => c.type === 'currency');
                if (currencyCol) {
                    const valorOriginal = parseFloat(item[currencyCol.key]) || 0;
                    currencyFormats.forEach((fmt, idx) => {
                        rowData[`valor_test_${idx}`] = valorOriginal;
                    });
                }
            }

            const row = sheet.addRow(rowData);

            // Style Row
            const rowStyle = index % 2 === 0 ? ROW_COLOR_EVEN : ROW_COLOR_ODD; // Alternating colors

            row.eachCell((cell, colNumber) => {
                cell.fill = rowStyle;
                cell.border = BORDER_STYLE;
                cell.font = {
                    size: 11,
                    color: { argb: 'FF1E293B' }
                };

                const columnDef = columns[colNumber - 1];

                // TEST MODE: Apply formats to test columns
                if (TEST_MODE && colNumber > columns.length) {
                    const testColIdx = colNumber - columns.length - 1;
                    if (testColIdx >= 0 && testColIdx < currencyFormats.length) {
                        cell.numFmt = currencyFormats[testColIdx].pattern;
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        return; // Skip regular formatting for test columns
                    }
                }

                // Apply number format based on type
                if (columnDef && columnDef.type === 'date') {
                    // Brazilian date format: DD/MM/AAAA
                    cell.numFmt = 'dd/mm/yyyy';
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (columnDef && columnDef.type === 'currency') {
                    // Brazilian currency format - Simple and reliable
                    // Uses comma as decimal separator (Brazilian standard)
                    cell.numFmt = 'R$ #,##0.00';
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                } else if (columnDef && (columnDef.key === 'active' || columnDef.type === 'center')) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (columnDef && columnDef.type === 'number') {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            });
        });

        // 3. Write and Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${fileName}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    }
};

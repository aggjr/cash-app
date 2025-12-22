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

        // Define Columns
        sheet.columns = columns.map(c => ({
            header: c.header,
            key: c.key,
            width: c.width || 20
        }));

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

                rowData[col.key] = value;
            });

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

                // Alignment based on type or column index
                // Center Status or generic 'center' type
                if (columns[colNumber - 1].key === 'active' || columns[colNumber - 1].type === 'center') {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (columns[colNumber - 1].type === 'number' || columns[colNumber - 1].type === 'currency') {
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

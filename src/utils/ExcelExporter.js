// import ExcelJS from '../assets/exceljs.min.js';
const ExcelJS = window.ExcelJS;

/**
 * Excel Exporter with Styling (ExcelJS)
 * Mimics the Generic Tree view styles
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

        // Define Columns
        sheet.columns = [
            { header: 'Estrutura', key: 'label', width: 60 },
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

        // Fix alignment for first column header
        headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

        // 2. Flatten Tree with indentation logic
        const processNode = (node, level = 0) => {
            const isRoot = level === 0;

            // Add Row
            const row = sheet.addRow({
                label: node.label,
                status: node.active ? 'Ativo' : 'Inativo'
            });

            // Style Row
            const rowStyle = isRoot ? ROW_COLOR_ROOT : ROW_COLOR_CHILD;

            // Cell 1: Label (Indented)
            const cellLabel = row.getCell(1);
            cellLabel.fill = rowStyle;
            cellLabel.font = {
                size: 11,
                color: { argb: node.active ? 'FF1E293B' : 'FF94A3B8' }, // Dark or Muted
                bold: isRoot
            };
            cellLabel.alignment = {
                vertical: 'middle',
                indent: level // ExcelJS supports indent natively
            };
            cellLabel.border = BORDER_STYLE;

            // Cell 2: Status (Centered)
            const cellStatus = row.getCell(2);
            cellStatus.fill = rowStyle;
            cellStatus.font = {
                size: 11,
                italic: true,
                color: { argb: node.active ? 'FF1E293B' : 'FF94A3B8' }
            };
            cellStatus.alignment = { vertical: 'middle', horizontal: 'center' };
            cellStatus.border = BORDER_STYLE;

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
    }
};

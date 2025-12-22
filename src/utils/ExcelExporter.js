import XLSX from 'xlsx-js-style';

/**
 * Excel Exporter with Styling
 * Mimics the Generic Tree view styles
 */
export const ExcelExporter = {

    /**
     * Exports tree data to formatted Excel
     * @param {Array} treeData - The hierarchical tree data
     * @param {string} title - Worksheet title
     * @param {string} fileName - Download filename
     */
    exportTree: (treeData, title, fileName) => {
        // Defines
        const HEADER_COLOR = '0F172A'; // Dark slate
        const HEADER_FONT_COLOR = 'FFFFFF';
        const BORDER_COLOR = 'E2E8F0';

        // Colors for levels (approximating the UI)
        // Root: often blueish or distinct
        // Children: lighter
        const ROW_COLORS = {
            root: 'F8FAFC', // Slate 50
            child: 'FFFFFF'
        };

        const rows = [];

        // 1. Header Row
        const headerRow = [
            {
                v: 'Estrutura', t: 's', s: {
                    font: { bold: true, color: { rgb: HEADER_FONT_COLOR }, sz: 12 },
                    fill: { fgColor: { rgb: HEADER_COLOR } },
                    alignment: { horizontal: 'left', vertical: 'center' },
                    border: { bottom: { style: 'thin', color: { rgb: BORDER_COLOR } } }
                }
            },
            {
                v: 'Status', t: 's', s: {
                    font: { bold: true, color: { rgb: HEADER_FONT_COLOR }, sz: 12 },
                    fill: { fgColor: { rgb: HEADER_COLOR } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: { bottom: { style: 'thin', color: { rgb: BORDER_COLOR } } }
                }
            }
        ];
        rows.push(headerRow);

        // 2. Flatten Tree with indentation logic
        const processNode = (node, level = 0) => {
            const isRoot = level === 0;
            const indentSpaces = "    ".repeat(level); // 4 spaces per level
            const prefix = level === 0 ? '' : (level === 1 ? '  └─ ' : '      └─ ');

            // UI mimic: Indentation visual
            // We can either use Excel indentation feature OR spaces in text
            // Excel cell alignment has `indent: number`

            const cellStyle = {
                font: {
                    sz: 11,
                    bold: isRoot,
                    color: { rgb: node.active ? '1E293B' : '94A3B8' } // Dark or muted if inactive
                },
                fill: { fgColor: { rgb: isRoot ? ROW_COLORS.root : ROW_COLORS.child } },
                alignment: {
                    vertical: 'center',
                    indent: level // Excel indent level
                },
                border: {
                    bottom: { style: 'thin', color: { rgb: BORDER_COLOR } },
                    right: { style: 'thin', color: { rgb: BORDER_COLOR } },
                    left: { style: 'thin', color: { rgb: BORDER_COLOR } }
                }
            };

            // Name Cell
            const label = node.label;

            // Status Cell
            const statusStyle = {
                ...cellStyle,
                alignment: { horizontal: 'center', vertical: 'center' },
                font: { ...cellStyle.font, italic: true }
            };

            rows.push([
                { v: label, t: 's', s: cellStyle },
                { v: node.active ? 'Ativo' : 'Inativo', t: 's', s: statusStyle }
            ]);

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => processNode(child, level + 1));
            }
        };

        treeData.forEach(node => processNode(node));

        // 3. Create Workbook
        const ws = XLSX.utils.aoa_to_sheet([]);

        // Add data manually to support styles (aoa_to_sheet cleans styles usually, but xlsx-js-style might handle objects)
        // With xlsx-js-style, we construct the sheet object directly for best results

        // Set Column Widths
        ws['!cols'] = [
            { wch: 60 }, // Structure (wide)
            { wch: 15 }  // Status
        ];

        // Populate cells
        rows.forEach((row, rIndex) => {
            row.forEach((cell, cIndex) => {
                const cellRef = XLSX.utils.encode_cell({ r: rIndex, c: cIndex });
                ws[cellRef] = cell;
            });
        });

        // Set Range
        ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 1, r: rows.length - 1 } });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31)); // Max 31 chars

        // 4. Download
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }
};

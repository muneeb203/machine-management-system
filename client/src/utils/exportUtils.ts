import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { addPDFHeader } from './printHelpers';

// Add type definition for jspdf-autotable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

export const exportToPDF = (
    columns: { header: string; dataKey: string }[],
    data: any[],
    title: string,
    factoryDetails?: any
) => {
    const doc = new jsPDF();

    // Use shared header helper
    let startY = 40;
    if (factoryDetails) {
        startY = addPDFHeader(doc, factoryDetails, title) + 10;
    } else {
        // Fallback title if no details
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    }

    // Table
    doc.autoTable({
        startY: startY,
        head: [columns.map(col => col.header)],
        body: data.map(row => columns.map(col => {
            // Handle cell values (sometimes null/undef)
            const val = row[col.dataKey];
            return val !== null && val !== undefined ? val : '';
        })),
        theme: 'grid',
        headStyles: { fillColor: [25, 118, 210] }, // Primary color
        styles: { fontSize: 8 }
    });

    // Footer check
    if (factoryDetails?.footer_text) {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(factoryDetails.footer_text, 14, pageHeight - 10);
    }

    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
};

export const exportToExcel = (data: any[], title: string, factoryDetails?: any) => {
    // 1. Prepare Header Rows if factoryDetails exists
    const worksheetData: any[] = [];

    if (factoryDetails) {
        worksheetData.push([factoryDetails.factory_name]);
        worksheetData.push([
            [factoryDetails.address, factoryDetails.phone, factoryDetails.email].filter(Boolean).join(' | ')
        ]);
        worksheetData.push([title]);
        worksheetData.push([`Generated on: ${new Date().toLocaleString()}`]);
        worksheetData.push([]); // Spacer
    } else {
        worksheetData.push([title]);
        worksheetData.push([]);
    }

    // 2. Add Data
    // We should probably explicitly map columns if 'data' has extra fields, but for now we dump 'data'
    // Actually, 'data' passed from Reports often matched DataGrid rows.
    // Let's assume data is ready-to-print or we use xlsx structure.
    // The previous implementation used json_to_sheet.

    const sheetFromData = XLSX.utils.json_to_sheet(data);
    const dataRange = XLSX.utils.decode_range(sheetFromData['!ref'] || 'A1');

    // We can't easily "append" json_to_sheet to existing array easily without manual row moving.
    // Better way: Convert data to array of arrays.

    // If data is array of objects, extract headers and values
    if (data.length > 0) {
        const headers = Object.keys(data[0]);
        worksheetData.push(headers);
        data.forEach(row => {
            worksheetData.push(headers.map(h => row[h]));
        });
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Merge Factory Name (Row 1)
    if (factoryDetails) {
        if (!worksheet['!merges']) worksheet['!merges'] = [];
        worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }); // Merge Title across 6 cols
        worksheet['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }); // Merge Address
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${title.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
};

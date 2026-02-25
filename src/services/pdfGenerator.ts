// import PDFDocument from 'pdfkit';
import { Writable } from 'stream';

interface BillData {
    bill_number?: string;
    bill_date: string;
    party_name: string;
    po_number?: string;
}

interface BillItemData {
    design_no?: string;
    item_description?: string;
    qty?: number;
    stitches: number;
    rate_type: string;
    rate_per_unit: number;
    amount: number;
}

/**
 * Generate PDF for a bill with items
 */
export const generateBillPDF = (
    bill: BillData,
    items: BillItemData[],
    factory?: any
): Promise<Buffer> => {
    return Promise.reject(new Error('PDF generation is disabled'));
    /*
    return new Promise((resolve, reject) => {
        // ... (commented out due to missing pdfkit)
    });
    */
};

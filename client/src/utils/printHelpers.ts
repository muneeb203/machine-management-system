import { api } from '../apiClient';
import jsPDF from 'jspdf';

// Fetch details just in case they aren't passed
export const getFactoryDetails = async () => {
    try {
        const res = await api.get('/api/settings/factory');
        return res.data.data; // { factory_name, address, phone, email, logo_url, footer_text }
    } catch (e) {
        return null;
    }
};

export const getPrintHeaderHTML = (details: any, title: string) => {
    const factory = details || { factory_name: 'Embroidery ERP' };

    // We can conditionally render Logo if URL exists and is valid image
    // Note: For print window, relative paths like /uploads/.. work if base is same.
    const logoHtml = factory.logo_url
        ? `<img src="${factory.logo_url}" style="height: 60px; max-width: 150px; object-fit: contain; margin-right: 20px;" />`
        : '';

    return `
        <div style="display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
            <div style="flex-shrink: 0;">${logoHtml}</div>
            <div style="flex-grow: 1;">
                <h1 style="margin: 0; font-size: 24px; color: #1a237e;">${factory.factory_name}</h1>
                <div style="font-size: 12px; color: #555; margin-top: 5px;">
                    ${factory.address ? `<span>${factory.address}</span>` : ''}
                    ${factory.phone ? ` | <span>Phone: ${factory.phone}</span>` : ''}
                    ${factory.email ? ` | <span>Email: ${factory.email}</span>` : ''}
                </div>
                <div style="font-size: 14px; margin-top: 5px; font-weight: bold;">
                   ${title}
                </div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #888;">
                <div>Production Management System</div>
                <div>Powered by <strong>Convosol</strong></div>
            </div>
        </div>
    `;
};

export const addPDFHeader = (doc: jsPDF, details: any, title: string) => {
    const factory = details || { factory_name: 'Embroidery ERP' };
    const pageWidth = doc.internal.pageSize.getWidth();

    // Simple Header
    doc.setFontSize(18);
    doc.text(factory.factory_name, 14, 20);

    doc.setFontSize(10);
    let y = 26;
    if (factory.address) { doc.text(factory.address, 14, y); y += 5; }
    if (factory.phone || factory.email) {
        doc.text(`${factory.phone || ''}  ${factory.email || ''}`, 14, y);
        y += 5;
    }

    // Title
    doc.setFontSize(14);
    doc.setFont(undefined as any, 'bold');
    doc.text(title.toUpperCase(), 14, y + 5);
    doc.setFont(undefined as any, 'normal');

    // Powered By (Bottom Right or Top Right)
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Powered by Convosol", pageWidth - 40, 15);
    doc.setTextColor(0);

    return y + 15; // Return Y start position for content
};

import { Router, Response } from 'express';
import { db } from '../../database/connection';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { BillService } from '../../services/BillService';
import { validateBill, validateBillItem } from '../validators/billValidators';
// import { generateBillPDF } from '../../services/pdfGenerator';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Allowed roles for billing operations
const requireBillingAccess = requireRole(['admin', 'billing', 'finance', 'production']);

/**
 * GET /api/bills
 * Get all bills with pagination
 */
router.get('/', requireBillingAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await BillService.getAllBills(page, limit);

    res.json({
        data: result.bills,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
        },
    });
}));

router.post('/', requireBillingAccess, validateBill, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { items, ...billData } = req.body;
    let billId: number;

    if (items && Array.isArray(items) && items.length > 0) {
        billId = await BillService.createFullBill(billData, items, req.user!.id);
    } else {
        billId = await BillService.createBill(billData, req.user!.id);
    }

    // Fetch the created bill to return complete data
    const { bill } = await BillService.getBillWithItems(billId);

    res.status(201).json({ data: bill });
}));

/**
 * GET /api/bills/:id
 * Get bill with all items
 */
router.get('/:id', requireBillingAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const billId = parseInt(req.params.id);
    const result = await BillService.getBillWithItems(billId);

    res.json({ data: result });
}));

/**
 * PUT /api/bills/:id
 * Update bill header
 */
router.put('/:id', requireBillingAccess, validateBill, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const billId = parseInt(req.params.id);
    await BillService.updateBill(billId, req.body, req.user!.id);

    const { bill } = await BillService.getBillWithItems(billId);
    res.json({ data: bill });
}));

/**
 * POST /api/bills/:id/items
 * Add item to bill (server computes amount)
 */
router.post('/:id/items', requireBillingAccess, validateBillItem, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const billId = parseInt(req.params.id);
    const item = await BillService.addBillItem(billId, req.body, req.user!.id);

    res.status(201).json({ data: item });
}));

/**
 * PUT /api/bills/:id/items/:itemId
 * Update bill item (recomputes amount)
 */
router.put('/:id/items/:itemId', requireBillingAccess, validateBillItem, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId);
    const updatedItem = await BillService.updateBillItem(itemId, req.body, req.user!.id);

    res.json({ data: updatedItem });
}));

/**
 * DELETE /api/bills/:id/items/:itemId
 * Delete bill item
 */
router.delete('/:id/items/:itemId', requireBillingAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId);
    await BillService.deleteBillItem(itemId, req.user!.id);

    res.json({ message: 'Bill item deleted successfully' });
}));

/**
 * DELETE /api/bills/:id
 * Delete bill (cascades to items)
 */
router.delete('/:id', requireBillingAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const billId = parseInt(req.params.id);
    await BillService.deleteBill(billId, req.user!.id);

    res.json({ message: 'Bill deleted successfully' });
}));

/**
 * POST /api/bills/:id/export
 * Export bill to CSV or PDF
 */
router.post('/:id/export', requireBillingAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const billId = parseInt(req.params.id);
    const format = req.query.format as string || 'csv';

    const { bill, items } = await BillService.getBillWithItems(billId);
    const factory = await db('factory_details').where('is_active', true).first();

    if (format === 'csv') {
        // Generate CSV
        const csvLines: string[] = [];

        // Header info
        csvLines.push(`Bill Number,Bill Date,Party,PO Number`);
        csvLines.push(`${bill.bill_number || 'Draft'},${bill.bill_date},${bill.party_name},${bill.po_number || ''}`);
        csvLines.push('');

        // Items header
        csvLines.push(`Design No,Collection,Component,Item,Qty,Stitches,Rate Type,Rate,Amount`);

        // Items data
        items.forEach(item => {
            csvLines.push(
                `${item.design_no || ''},${item.collection || ''},${item.component || ''},${item.item_description || ''},${item.qty || 0},${item.stitches},${item.rate_type},${item.rate_per_unit},${item.amount}`
            );
        });

        // Totals
        const totalStitches = items.reduce((sum, item) => sum + Number(item.stitches), 0);
        const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);
        csvLines.push('');
        csvLines.push(`Total Items,Total Stitches,Total Amount`);
        csvLines.push(`${items.length},${totalStitches},${totalAmount.toFixed(2)}`);

        const csv = csvLines.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bill_${bill.bill_number || 'draft'}.csv"`);
        res.send(csv);
    } else if (format === 'pdf') {
        // Generate PDF
        // const pdfBuffer = await generateBillPDF(bill, items, factory);
        res.status(501).json({ error: 'PDF generation is temporarily disabled due to missing dependencies' });

        // res.setHeader('Content-Type', 'application/pdf');
        // res.setHeader('Content-Disposition', `attachment; filename="bill_${bill.bill_number || 'draft'}.pdf"`);
        // res.send(pdfBuffer);
    } else {
        res.status(400).json({ error: 'Invalid format. Use csv or pdf' });
    }
}));

export default router;

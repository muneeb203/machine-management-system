import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/clipping-vendors/debug
 * Debug endpoint to check raw data
 */
router.get('/debug', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get raw data to debug the issue
    const rawData = await db('ClippingVendors as cv')
        .leftJoin('Clipping as c', 'cv.id', 'c.VendorID')
        .leftJoin('ClippingItem as ci', 'c.ClippingID', 'ci.ClippingID')
        .select(
            'cv.id as vendor_id',
            'cv.vendor_name',
            'c.ClippingID',
            'ci.ClippingItemID',
            'ci.QuantitySent',
            'ci.QuantityReceived',
            'ci.Status'
        )
        .orderBy('cv.id');

    // Also get the aggregated data
    const aggregatedData = await db('ClippingVendors as cv')
        .leftJoin('Clipping as c', 'cv.id', 'c.VendorID')
        .leftJoin('ClippingItem as ci', 'c.ClippingID', 'ci.ClippingID')
        .select(
            'cv.id',
            'cv.vendor_name',
            db.raw('COUNT(ci.ClippingItemID) as item_count'),
            db.raw('SUM(ci.QuantitySent) as total_sent'),
            db.raw('SUM(ci.QuantityReceived) as total_received')
        )
        .groupBy('cv.id', 'cv.vendor_name');

    res.json({ 
        rawData,
        aggregatedData,
        message: 'Debug data for troubleshooting vendor progress calculations'
    });
}));

/**
 * GET /api/clipping-vendors
 * Fetch all vendors with accurate progress information
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get all vendors first
    const allVendors = await db('ClippingVendors')
        .select('*')
        .orderBy('vendor_name', 'asc');

    // Calculate progress for each vendor
    const vendorsWithProgress = await Promise.all(
        allVendors.map(async (vendor) => {
            // Get all clipping records for this vendor
            const clippingRecords = await db('Clipping as c')
                .leftJoin('ClippingItem as ci', 'c.ClippingID', 'ci.ClippingID')
                .where('c.VendorID', vendor.id)
                .select(
                    'c.ClippingID',
                    'ci.ClippingItemID',
                    'ci.QuantitySent',
                    'ci.QuantityReceived',
                    'ci.Status'
                );

            // Group by ClippingID to analyze each contract
            const contractsMap = new Map();
            clippingRecords.forEach(record => {
                if (!record.ClippingID) return; // Skip if no clipping record

                if (!contractsMap.has(record.ClippingID)) {
                    contractsMap.set(record.ClippingID, {
                        clippingId: record.ClippingID,
                        items: []
                    });
                }

                if (record.ClippingItemID) {
                    contractsMap.get(record.ClippingID).items.push({
                        itemId: record.ClippingItemID,
                        quantitySent: parseFloat(record.QuantitySent || 0),
                        quantityReceived: parseFloat(record.QuantityReceived || 0),
                        status: record.Status
                    });
                }
            });

            const contracts = Array.from(contractsMap.values());

            // Calculate metrics
            const totalAssigned = contracts.length;
            
            let totalCompleted = 0;
            let totalPending = 0;

            contracts.forEach(contract => {
                if (contract.items.length === 0) {
                    totalPending++;
                    return;
                }

                // Check if contract is completed
                const isCompleted = contract.items.every(item => 
                    item.status === 'Completed' || 
                    (item.quantityReceived >= item.quantitySent && item.quantitySent > 0)
                );

                if (isCompleted) {
                    totalCompleted++;
                } else {
                    totalPending++;
                }
            });

            // Determine work status
            let workStatus = 'Pending';
            if (totalAssigned > 0) {
                if (totalCompleted === totalAssigned) {
                    workStatus = 'Completed';
                } else if (totalCompleted > 0) {
                    workStatus = 'Ongoing';
                }
            }

            return {
                ...vendor,
                total_assigned: totalAssigned,
                total_completed: totalCompleted,
                total_pending: totalPending,
                work_status: workStatus
            };
        })
    );

    res.json({ data: vendorsWithProgress });
}));

/**
 * GET /api/clipping-vendors/:id/progress
 * Get detailed progress information for a specific vendor
 */
router.get('/:id/progress', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const vendorId = parseInt(req.params.id);

    // Get vendor basic info
    const vendor = await db('ClippingVendors').where('id', vendorId).first();
    if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
    }

    // Get all clipping contracts for this vendor with detailed information
    const clippingContracts = await db('Clipping as c')
        .where('c.VendorID', vendorId)
        .select(
            'c.ClippingID as id',
            'c.VendorName as vendor_name',
            'c.ContactNumber as contact_number',
            'c.CreatedAt as created_at',
            'c.UpdatedAt as updated_at'
        )
        .orderBy('c.CreatedAt', 'desc');

    // Get detailed items for each contract and calculate contract status
    const contractsWithDetails = await Promise.all(
        clippingContracts.map(async (contract) => {
            // Get all items for this contract
            const items = await db('ClippingItem as ci')
                .leftJoin('ContractItem as cti', 'ci.ContractItemID', 'cti.ContractItemID')
                .leftJoin('Contract as ct', 'cti.ContractID', 'ct.ContractID')
                .where('ci.ClippingID', contract.id)
                .select(
                    'ci.ClippingItemID as id',
                    'ci.Description as description',
                    'ci.QuantitySent as quantity_sent',
                    'ci.QuantityReceived as quantity_received',
                    'ci.DateSent as date_sent',
                    'ci.LastReceivedDate as last_received_date',
                    'ci.Status as status',
                    'ct.ContractNo as contract_number',
                    'ct.PONumber as po_number',
                    'cti.Collection as collection',
                    'cti.DesignNo as design_no'
                )
                .orderBy('ci.DateSent', 'desc');

            // Calculate contract status
            let contractStatus = 'Pending';
            if (items.length > 0) {
                const isCompleted = items.every(item => 
                    item.status === 'Completed' || 
                    (parseFloat(item.quantity_received || 0) >= parseFloat(item.quantity_sent || 0) && parseFloat(item.quantity_sent || 0) > 0)
                );

                if (isCompleted) {
                    contractStatus = 'Completed';
                } else {
                    const hasOngoingWork = items.some(item => 
                        item.status === 'Partially Received' || 
                        parseFloat(item.quantity_received || 0) > 0
                    );
                    contractStatus = hasOngoingWork ? 'Ongoing' : 'Pending';
                }
            }

            // Calculate totals for this contract
            const totalSent = items.reduce((sum, item) => sum + parseFloat(item.quantity_sent || 0), 0);
            const totalReceived = items.reduce((sum, item) => sum + parseFloat(item.quantity_received || 0), 0);
            const totalPending = totalSent - totalReceived;

            return {
                ...contract,
                contract_status: contractStatus,
                total_items: items.length,
                total_sent: totalSent,
                total_received: totalReceived,
                total_pending: totalPending,
                completed_items: items.filter(item => item.status === 'Completed').length,
                ongoing_items: items.filter(item => item.status === 'Partially Received').length,
                pending_items: items.filter(item => item.status === 'Sent').length,
                items: items
            };
        })
    );

    // Separate completed and ongoing/pending contracts
    const completedContracts = contractsWithDetails.filter(c => c.contract_status === 'Completed');
    const ongoingContracts = contractsWithDetails.filter(c => c.contract_status !== 'Completed');

    // Calculate summary statistics
    const summary = {
        total_assigned: contractsWithDetails.length,
        total_completed: completedContracts.length,
        total_ongoing: ongoingContracts.length,
        total_items: contractsWithDetails.reduce((sum, c) => sum + c.total_items, 0),
        total_sent: contractsWithDetails.reduce((sum, c) => sum + c.total_sent, 0),
        total_received: contractsWithDetails.reduce((sum, c) => sum + c.total_received, 0),
        total_pending: contractsWithDetails.reduce((sum, c) => sum + c.total_pending, 0)
    };

    res.json({ 
        data: {
            vendor,
            summary,
            completed_contracts: completedContracts,
            ongoing_contracts: ongoingContracts,
            all_contracts: contractsWithDetails
        }
    });
}));

/**
 * POST /api/clipping-vendors
 * Create new vendor
 */
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { vendorName, contactNumber, cnic, address } = req.body;

    if (!vendorName || vendorName.length < 2) {
        return res.status(400).json({ message: 'Vendor Name is required (min 2 chars).' });
    }
    if (!contactNumber) {
        return res.status(400).json({ message: 'Contact Number is required.' });
    }

    // Check duplicate
    const existing = await db('ClippingVendors').where('contact_number', contactNumber).first();
    if (existing) {
        return res.status(409).json({ message: 'Vendor with this Contact Number already exists.' });
    }

    const [id] = await db('ClippingVendors').insert({
        vendor_name: vendorName,
        contact_number: contactNumber,
        cnic: cnic,
        address: address
    });

    const newVendor = await db('ClippingVendors').where('id', id).first();
    res.status(201).json({ data: newVendor, message: 'Vendor added successfully.' });
}));

/**
 * PUT /api/clipping-vendors/:id
 * Update vendor
 */
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const { vendorName, contactNumber, cnic, address } = req.body;

    if (!vendorName || vendorName.length < 2) {
        return res.status(400).json({ message: 'Vendor Name is required (min 2 chars).' });
    }
    if (!contactNumber) {
        return res.status(400).json({ message: 'Contact Number is required.' });
    }

    // Check duplicate if contact changed
    const existing = await db('ClippingVendors')
        .where('contact_number', contactNumber)
        .andWhereNot('id', id)
        .first();

    if (existing) {
        return res.status(409).json({ message: 'Vendor with this Contact Number already exists.' });
    }

    await db('ClippingVendors').where('id', id).update({
        vendor_name: vendorName,
        contact_number: contactNumber,
        cnic: cnic,
        address: address,
        updated_at: new Date()
    });

    const updated = await db('ClippingVendors').where('id', id).first();
    res.json({ data: updated, message: 'Vendor updated successfully.' });
}));

/**
 * DELETE /api/clipping-vendors/:id
 * Delete vendor if no pending orders
 */
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    // Check for pending/active orders
    // We check the Clipping Item table status via JOIN or check Clipping header if that's where we track general status?
    // The items track status. 
    // Logic: Find all Clipping entries for this VendorID. Check their items.

    // OR simpler: If ANY clipping record exists for this vendor, prevent delete? 
    // Requirement says: "Vendor cannot be deleted if there are pending or in-progress clipping orders. Deletion allowed only if all orders are completed."

    // 1. Find mappings
    const activeOrders = await db('Clipping')
        .join('ClippingItem', 'Clipping.ClippingID', 'ClippingItem.ClippingID')
        .where('Clipping.VendorID', id)
        .whereIn('ClippingItem.Status', ['Sent', 'Partially Received']) // Not 'Completed'
        .distinct('Clipping.ClippingID');

    if (activeOrders.length > 0) {
        return res.status(409).json({
            message: `Cannot delete. This vendor has pending clipping orders. Pending Order(s): ${activeOrders.map(o => '#' + o.ClippingID).join(', ')}`
        });
    }

    // If only 'Completed' orders exist, can we delete?
    // Usually "Soft Delete" or "Archived" is better.
    // But requirement says "Deletion allowed only if all orders are completed".
    // This implies if they are completed, we CAN delete the VENdor? 
    // If we delete the vendor, the historical data loses its link unless we keep the vendor row or use soft delete.
    // Given the FK is RESTRICT, we probably can't delete if ANY record exists regardless of status, unless we cascade or nullify.
    // Wait, the Migration said `onDelete('RESTRICT')`. So we CANNOT delete if ANY clipping exists.
    // The user requirement implies we SHOULD be able to delete if completed.
    // To enable this, we would need to either:
    // A) Nullify the FK (Set VendorID = null) -> Historical records lose vendor info? Bad.
    // B) Soft delete vendor (Status = Deleted).
    // C) Change migration to not restrict?

    // I shall implement Soft Delete if possible or just restrict for now to be safe (as per "Future-safe" note).
    // "No delete option for now" in UI suggests simple restriction is fine.
    // I'll stick to error message return.

    // Also, checking if ANY clipping exists (even completed) because of Foreign Key Constraint. 
    // If I try to delete, SQL will throw error.
    // I should probably warn about history too.

    // Let's implement the specific check requested by user first.

    await db('ClippingVendors').where('id', id).del().catch((err) => {
        // Catch FK constraint error
        if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.message.includes('foreign key constraint fails')) {
            throw new Error("Cannot delete vendor because they have associated clipping records (Completed or Pending).");
        }
        throw err;
    });

    res.json({ message: 'Vendor deleted successfully.' });
}));

export const clippingVendorsRouter = router;

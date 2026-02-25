import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/contract-items
 * Searchable list of contract items for dropdowns
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const q = req.query.q as string; // Search term
    const onlyPending = req.query.onlyPending === 'true';

    let query = db('ContractItem')
        .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
        .leftJoin('ProductionEntry', 'ContractItem.ContractItemID', 'ProductionEntry.ContractItemID')
        .select(
            'ContractItem.ContractItemID as contractItemId',
            'Contract.ContractID as contractId',
            'Contract.ContractNo as contractNo',
            'Contract.ContractDate as contractDate', // Optional meta
            'Contract.PONumber as poNumber',        // Optional meta
            'ContractItem.Collection as collection',
            db.raw('COALESCE(ContractItem.DesignNo, ContractItem.ItemDescription) as itemLabel'),
            'ContractItem.ItemDescription as description',
            'ContractItem.DesignNo as designNo',
            'ContractItem.Stitch as stitch',
            'ContractItem.Pieces as pieces',
            'ContractItem.Color as color',
            db.raw('(SELECT GROUP_CONCAT(MachineID) FROM ContractItemMachine WHERE ContractItemMachine.ContractItemID = ContractItem.ContractItemID) as assignedMachineIds'),
            db.raw('(SELECT GROUP_CONCAT(CONCAT(MachineID, ":", pending_stitches)) FROM ContractItemMachine WHERE ContractItemMachine.ContractItemID = ContractItem.ContractItemID) as machinePending'),
            db.raw('COALESCE(SUM(ProductionEntry.Stitches), 0) as usedStitches'),
            db.raw('COALESCE(SUM(ProductionEntry.Repeats), 0) as usedRepeats')
        )
        .where('Contract.IsActive', 1)
        .groupBy(
            'ContractItem.ContractItemID',
            'Contract.ContractID',
            'Contract.ContractNo',
            'Contract.ContractDate',
            'Contract.PONumber',
            'ContractItem.Collection',
            'ContractItem.DesignNo',
            'ContractItem.ItemDescription',
            'ContractItem.Stitch',
            'ContractItem.Pieces',
            'ContractItem.Color'
        );

    // Filter by Search Query
    if (q) {
        query = query.where(function () {
            this.where('Contract.ContractNo', 'like', `%${q}%`)
                .orWhere('ContractItem.Collection', 'like', `%${q}%`)
                .orWhere('ContractItem.DesignNo', 'like', `%${q}%`)
                .orWhere('ContractItem.ItemDescription', 'like', `%${q}%`);
        });
    }

    // Filter by Pending Stitches (if requested)
    if (onlyPending) {
        query = query.havingRaw('ContractItem.Stitch > COALESCE(SUM(ProductionEntry.Stitches), 0)');
    } else {
        // Even if not filtering, sorting by ContractNo is good
        query = query.orderBy('Contract.ContractNo', 'desc')
            .orderBy('ContractItem.Collection', 'asc');
    }

    // Pagination
    // Wrapping in a subquery for correct count with GROUP BY
    const totalQuery = db.from(query.clone().as('sub')).count('* as count').first();
    const totalResult = await totalQuery;
    const total = typeof totalResult === 'object' ? Number((totalResult as any)?.count || 0) : Number(totalResult || 0);

    const items = await query.limit(limit).offset(offset);

    res.json({
        data: items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });

}));

/**
 * GET /api/contract-items/by-contract/:contractId
 * Get all items for a specific contract
 */
router.get('/by-contract/:contractId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId);
    
    if (isNaN(contractId)) {
        return res.status(400).json({ error: 'Invalid contract ID' });
    }

    const items = await db('ContractItem')
        .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
        .where('ContractItem.ContractID', contractId)
        .where('Contract.IsActive', 1)
        .select(
            'ContractItem.ContractItemID as contractItemId',
            'ContractItem.ContractID as contractId',
            'ContractItem.Collection as collection',
            'ContractItem.DesignNo as designNo',
            'ContractItem.Component as component',
            'ContractItem.ItemDescription as itemDescription',
            'ContractItem.Fabric as fabric',
            'ContractItem.Color as color',
            'ContractItem.Stitch as stitch',
            'ContractItem.Pieces as pieces',
            'ContractItem.Repeat as repeat',
            'ContractItem.Rate_per_Stitch as ratePerStitch',
            'ContractItem.Rate_per_Repeat as ratePerRepeat',
            'ContractItem.Rate_per_Piece as ratePerPiece',
            db.raw('COALESCE(ContractItem.Yards, 0) as yards')
        )
        .orderBy('ContractItem.Collection')
        .orderBy('ContractItem.DesignNo');

    const itemIds = items.map((i: any) => i.contractItemId);

    // Get used stitches/repeats from ProductionEntry, daily_production_master, and daily_billing
    let usageMap = new Map<number, { usedStitches: number; usedRepeats: number }>();
    if (itemIds.length > 0) {
        const [peUsage, dpmUsage, dbrUsage] = await Promise.all([
            db('ProductionEntry').whereIn('ContractItemID', itemIds)
                .select('ContractItemID').sum('Stitches as s').sum('Repeats as r').groupBy('ContractItemID'),
            db('daily_production_master').whereIn('contract_item_id', itemIds)
                .select('contract_item_id as ContractItemID').sum('total_stitches as s').groupBy('contract_item_id'),
            db('daily_billing_shift_records as dbsr')
                .join('daily_billing_records as dbr', 'dbsr.billing_record_id', 'dbr.id')
                .join('ContractItem as ci', function() {
                    this.on('ci.ContractID', '=', 'dbr.contract_id').andOn('ci.DesignNo', '=', 'dbsr.design_no');
                })
                .where('dbr.contract_id', contractId)
                .whereIn('ci.ContractItemID', itemIds)
                .select('ci.ContractItemID')
                .sum('dbsr.stitches_done as s')
                .groupBy('ci.ContractItemID')
        ]);

        itemIds.forEach((id: number) => {
            let usedStitches = 0;
            let usedRepeats = 0;
            (peUsage as any[]).filter((r: any) => r.ContractItemID === id).forEach((r: any) => {
                usedStitches += Number(r.s || 0);
                usedRepeats += Number(r.r || 0);
            });
            (dpmUsage as any[]).filter((r: any) => r.ContractItemID === id).forEach((r: any) => {
                usedStitches += Number(r.s || 0);
            });
            (dbrUsage as any[]).filter((r: any) => r.ContractItemID === id).forEach((r: any) => {
                usedStitches += Number(r.s || 0);
            });
            usageMap.set(id, { usedStitches, usedRepeats });
        });
    }

    const enriched = items.map((item: any) => {
        const usage = usageMap.get(item.contractItemId) || { usedStitches: 0, usedRepeats: 0 };
        const stitch = Number(item.stitch || 0);
        const pieces = Number(item.pieces || 0);
        const repeat = Number(item.repeat || 0);
        const totalPlannedStitches = stitch * pieces;
        const remainingStitches = Math.max(0, totalPlannedStitches - usage.usedStitches);
        const remainingRepeats = Math.max(0, repeat - usage.usedRepeats);
        return {
            ...item,
            usedStitches: usage.usedStitches,
            usedRepeats: usage.usedRepeats,
            totalPlannedStitches,
            remainingStitches,
            remainingRepeats
        };
    });

    res.json({ data: enriched });
}));

export { router as contractItemsRouter };

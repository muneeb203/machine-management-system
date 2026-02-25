
import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../../database/connection';
import { recalculateMachineWorkload } from '../../services/workload';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/production-master/info/:masterId
 * Get master details and machine count
 */
router.get('/info/:masterId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const masterId = parseInt(req.params.masterId);

    const master = await db('MachineMaster').where('MasterID', masterId).first();
    if (!master) return res.status(404).json({ message: 'Master not found' });

    // Fetches machines assigned to this master
    // Assuming Machine.MasterName matches MachineMaster.Name
    const machines = await db('Machine')
        .where('MasterName', master.Name)
        .select('MachineID', 'MachineNumber', 'gazana_machine', 'master_machine_number')
        .orderBy('master_machine_number', 'asc') // Order by master sequence
        .orderBy('MachineNumber', 'asc'); // Fallback

    const machineCount = machines.length;

    // Get Base Rate (Latest)
    const baseRate = await db('base_rates')
        .where('is_active', true)
        .orderBy('effective_from', 'desc')
        .first();

    const rate = Number(baseRate?.rate_per_stitch || 0.05); // Default to 0.05 if not found, or handle error

    res.json({
        data: {
            master,
            machineCount,
            machines, // Added list
            rate
        }
    });
}));

/**
 * GET /api/production-master/machine-history/:machineId
 * Get last 30 days production history for a machine from both tables
 */
router.get('/machine-history/:machineId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const machineId = parseInt(req.params.machineId);

    const history = await db.raw(`
        SELECT 
            date,
            collection,
            SUM(dayStitches) as dayStitches,
            SUM(nightStitches) as nightStitches,
            SUM(dayStitches + nightStitches) as totalStitches
        FROM (
            SELECT 
                DATE(pe.ProductionDate) as date,
                ci.Collection as collection,
                CASE WHEN pe.Shift IN ('Day', 'Morning') THEN pe.Stitches ELSE 0 END as dayStitches,
                CASE WHEN pe.Shift IN ('Night', 'Evening') THEN pe.Stitches ELSE 0 END as nightStitches
            FROM ProductionEntry pe
            JOIN ContractItem ci ON pe.ContractItemID = ci.ContractItemID
            WHERE pe.MachineID = ? AND pe.ProductionDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
            
            UNION ALL
            
            SELECT 
                DATE(dpm.production_date) as date,
                dpm.collection_name as collection,
                dpm.day_shift_stitches as dayStitches,
                dpm.night_shift_stitches as nightStitches
            FROM daily_production_master dpm
            WHERE dpm.machine_id = ? AND dpm.production_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        ) as combined
        GROUP BY date, collection
        ORDER BY date DESC
    `, [machineId, machineId]);

    // Knex raw result structure for MySQL
    const rows = history[0] || [];

    // Calculate summary
    const total30Days = rows.reduce((sum: number, r: any) => sum + Number(r.totalStitches), 0);
    const avgPerDayRaw = rows.length > 0 ? (total30Days / 30) : 0; // Avg over last 30 days, not just productive ones

    res.json({
        data: rows,
        summary: {
            total30Days,
            avgPerDay: Math.round(avgPerDayRaw)
        }
    });
}));

/**
 * GET /api/production-master/collections
 * Get list of available collections from Contracts
 */
router.get('/collections', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Distinct collection names
    const collections = await db('Contract')
        .distinct('collection_name')
        .whereNotNull('collection_name')
        .whereNot('collection_name', '')
        .orderBy('collection_name');

    // Extract strings
    const list = collections.map(c => c.collection_name);
    res.json({ data: list });
}));

/**
 * GET /api/production-master
 * List production entries
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Filters: date, masterId
    const { date, masterId } = req.query;

    let query = db('daily_production_master')
        .join('MachineMaster', 'daily_production_master.master_id', 'MachineMaster.MasterID')
        .leftJoin('Machine', 'daily_production_master.machine_id', 'Machine.MachineID')
        .select(
            'daily_production_master.*',
            'MachineMaster.Name as MasterName',
            'Machine.MachineNumber',
            'Machine.master_machine_number',
            'Machine.gazana_machine'
        )
        .orderBy('daily_production_master.production_date', 'desc');

    if (date) {
        query = query.where('daily_production_master.production_date', date as string);
    }
    if (masterId) {
        query = query.where('daily_production_master.master_id', masterId as string);
    }

    const entries = await query;
    res.json({ data: entries });
}));

/**
 * POST /api/production-master
 * Create new entry
 */
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
        masterId,
        machineId,
        contractItemId, // Added
        productionDate,
        collectionName,
        dayShiftStitches,
        nightShiftStitches,
        rate
    } = req.body;

    if (!masterId || !machineId || !productionDate || !collectionName) {
        return res.status(400).json({ message: 'Master, Machine, Date, and Collection are required' });
    }

    // 1. Check Uniqueness
    // Enhanced uniqueness check: exact match on contract item if provided?
    // User requirement: "If multiple items with same Collection... they still appear separately".
    // So duplicate check might need to be looser or include contractItemId?
    // Current check: master_id, production_date, collection_name.
    // If user produces for two DIFFERENT items that happen to have SAME collection name (rare but possible across contracts),
    // they should be allowed.
    // So we should add contract_item_id to unique check IF it's provided.

    let duplicateQuery = db('daily_production_master')
        .where({
            master_id: masterId,
            production_date: productionDate,
            collection_name: collectionName
        });

    if (contractItemId) {
        duplicateQuery = duplicateQuery.where('contract_item_id', contractItemId);
    }

    const existing = await duplicateQuery.first();

    if (existing) {
        return res.status(409).json({ message: 'Duplicate entry for this Master, Date, and Collection.' });
    }

    // 2. Get Machine Count Snapshot
    const master = await db('MachineMaster').where('MasterID', masterId).first();
    if (!master) return res.status(404).json({ message: 'Master not found' });

    const machineCountResult = await db('Machine')
        .where('MasterName', master.Name)
        .count('MachineID as count')
        .first();
    const machineCount = Number(machineCountResult?.count || 0);

    // 3. Calculate Totals
    const dayVal = Number(dayShiftStitches || 0);
    const nightVal = Number(nightShiftStitches || 0);
    const totalStitches = dayVal + nightVal;

    // Rate logic
    const billingRate = Number(rate || 0);
    const totalAmount = totalStitches * billingRate;

    try {
        await db.transaction(async (trx) => {
            const [id] = await trx('daily_production_master').insert({
                master_id: masterId,
                machine_id: machineId,
                contract_item_id: contractItemId || null,
                machines_count: machineCount,
                collection_name: collectionName,
                day_shift_stitches: dayVal,
                night_shift_stitches: nightVal,
                total_stitches: totalStitches,
                rate_per_stitch: billingRate,
                total_amount: totalAmount,
                production_date: productionDate
            }).returning('id'); // Ensure format matches knex version
        });

        // Recalculate ContractItemMachine.pending_stitches after commit (so new record is visible)
        if (contractItemId && machineId) {
            await recalculateMachineWorkload(contractItemId, machineId);
        }

        // Re-fetch to return full object (outside transaction is fine)
        const recentEntry = await db('daily_production_master')
            .where({
                master_id: masterId,
                machine_id: machineId,
                production_date: productionDate,
            })
            .orderBy('id', 'desc')
            .first();

        res.status(201).json({ data: recentEntry });

    } catch (error: any) {
        if (error.message.includes('exceeds pending stitches')) {
            return res.status(400).json({ message: error.message });
        }
        throw error;
    }
}));

/**
 * GET /api/production-master/billing-summary/:masterId
 * Get cumulative billing
 */
router.get('/billing-summary/:masterId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const masterId = parseInt(req.params.masterId);

    const result = await db('daily_production_master')
        .where('master_id', masterId)
        .sum('total_amount as total')
        .first();

    const totalBilling = Number(result?.total || 0);

    res.json({ data: { totalBilling } });
}));

/**
 * GET /api/production-master/:id
 * Get single entry details
 */
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    const entry = await db('daily_production_master')
        .join('MachineMaster', 'daily_production_master.master_id', 'MachineMaster.MasterID')
        .leftJoin('Machine', 'daily_production_master.machine_id', 'Machine.MachineID')
        .where('daily_production_master.id', id)
        .select(
            'daily_production_master.*',
            'MachineMaster.Name as MasterName',
            'Machine.MachineNumber',
            'Machine.master_machine_number',
            'Machine.gazana_machine'
        )
        .first();

    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    res.json({ data: entry });
}));

/**
 * PUT /api/production-master/:id
 * Update entry
 */
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const {
        collectionName,
        dayShiftStitches,
        nightShiftStitches,
        machineId, // Optional change
        rate // Optional override, otherwise keep existing
    } = req.body;

    const existing = await db('daily_production_master').where('id', id).first();
    if (!existing) return res.status(404).json({ message: 'Entry not found' });

    // 1. Validation
    if (!collectionName) return res.status(400).json({ message: 'Collection Name is required' });

    // Check Uniqueness (if key fields changed)
    if (collectionName !== existing.collection_name || (machineId && machineId !== existing.machine_id)) {
        const duplicate = await db('daily_production_master')
            .where({
                master_id: existing.master_id,
                production_date: existing.production_date,
                collection_name: collectionName
            })
            .whereNot('id', id)
            .first();

        if (duplicate) {
            return res.status(409).json({ message: 'Duplicate entry detected for this Master, Date, and Collection.' });
        }
    }

    try {
        await db.transaction(async (trx) => {
            const currentEntry = await trx('daily_production_master').where('id', id).first();
            if (!currentEntry) throw new Error('Entry not found');

            // 1. Prepare New Data
            const dayVal = Number(dayShiftStitches ?? currentEntry.day_shift_stitches);
            const nightVal = Number(nightShiftStitches ?? currentEntry.night_shift_stitches);
            const totalStitches = dayVal + nightVal;
            const newMachineId = machineId || currentEntry.machine_id;
            const contractItemId = currentEntry.contract_item_id;

            if (totalStitches < 0) throw new Error('Total stitches cannot be negative.');

            // 2. Update Entry (recalculate will run after commit)
            const billingRate = rate !== undefined ? Number(rate) : Number(currentEntry.rate_per_stitch);
            const totalAmount = totalStitches * billingRate;

            await trx('daily_production_master')
                .where('id', id)
                .update({
                    collection_name: collectionName,
                    day_shift_stitches: dayVal,
                    night_shift_stitches: nightVal,
                    total_stitches: totalStitches,
                    rate_per_stitch: billingRate,
                    total_amount: totalAmount,
                    machine_id: newMachineId,
                    updated_at: db.fn.now()
                });
        });

        // Recalculate pending for affected assignment(s)
        const updated = await db('daily_production_master').where('id', id).first();
        if (updated?.contract_item_id && updated?.machine_id) {
            await recalculateMachineWorkload(updated.contract_item_id, updated.machine_id);
        }
        if (existing.contract_item_id && existing.machine_id &&
            (existing.contract_item_id !== updated?.contract_item_id || existing.machine_id !== updated?.machine_id)) {
            await recalculateMachineWorkload(existing.contract_item_id, existing.machine_id);
        }

        res.json({ data: updated });

    } catch (error: any) {
        if (error.message === 'Entry not found') return res.status(404).json({ message: 'Entry not found' });
        if (error.message.includes('exceeds pending stitches')) return res.status(400).json({ message: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/production-master/:id
 * Delete entry and revert pending work
 */
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    const existing = await db('daily_production_master').where('id', id).first();
    if (!existing) return res.status(404).json({ message: 'Entry not found' });

    const contractItemId = existing.contract_item_id;
    const machineId = existing.machine_id;

    await db('daily_production_master').where('id', id).del();

    if (contractItemId && machineId) {
        await recalculateMachineWorkload(contractItemId, machineId);
    }

    res.json({ message: 'Entry deleted and work reverted successfully' });
}));

export const dailyProductionRouter = router;

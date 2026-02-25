import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/machines
 * List all machines
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { master, gazana, status } = req.query;

    let query = db('Machine').select('*');

    // Filter by Master Name
    if (master) {
        // Use case-insensitive and trimmed comparison to handle data inconsistencies
        const masterName = (master as string).trim();
        query = query.whereRaw('LOWER(TRIM(MasterName)) = ?', [masterName.toLowerCase()]);
    }

    // Filter by Gazana
    if (gazana) {
        query = query.where('gazana_machine', gazana as string);
    }

    // Filter by Workload Status
    if (status === 'Open') {
        // Machines with ANY pending work > 0
        query = query.whereExists(function () {
            this.select(1)
                .from('ContractItemMachine')
                .whereRaw('ContractItemMachine.MachineID = Machine.MachineID')
                .andWhere('pending_stitches', '>', 0);
        });
    } else if (status === 'Completed') {
        // Machines with assignments but NO pending work (all done)
        // OR we can interpreted as "Not having any pending work"
        // Let's ensure it has at least one assignment to be considered "Completed" rather than just "Brand new/Idle"
        query = query.whereExists(function () {
            this.select(1)
                .from('ContractItemMachine')
                .whereRaw('ContractItemMachine.MachineID = Machine.MachineID');
        }).whereNotExists(function () {
            this.select(1)
                .from('ContractItemMachine')
                .whereRaw('ContractItemMachine.MachineID = Machine.MachineID')
                .andWhere('pending_stitches', '>', 0);
        });
    }

    const machines = await query.orderBy('MachineNumber', 'asc');

    const formatted = machines.map(m => ({
        id: m.MachineID,
        machineNumber: m.MachineNumber,
        masterName: m.MasterName,
        masterMachineNumber: m.master_machine_number,
        status: m.Status, // Physical status
        gazanaMachine: m.gazana_machine,
        isActive: m.IsActive
    }));

    res.json({ data: formatted });
}));

// Helper to get next Master Machine Number
async function getNextMasterMachineNumber(masterName: string): Promise<number> {
    const result = await db('Machine')
        .where('MasterName', masterName)
        .max('master_machine_number as maxNum')
        .first();

    return (result?.maxNum || 0) + 1;
}

/**
 * GET /api/machines/next-number
 * Get the next auto-generated machine number
 */
router.get('/next-number', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const machines = await db('Machine').select('MachineNumber');

    let maxNum = 0;
    machines.forEach(m => {
        // Expected format: Machine-XXX
        if (typeof m.MachineNumber === 'string' && m.MachineNumber.startsWith('Machine-')) {
            const numPart = parseInt(m.MachineNumber.replace('Machine-', ''), 10);
            if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
            }
        } else if (typeof m.MachineNumber === 'number') {
            // Fallback if legacy numbers exist
            if (m.MachineNumber > maxNum) maxNum = m.MachineNumber;
        }
    });

    const nextNum = maxNum + 1;
    const paddedNum = nextNum.toString().padStart(3, '0');

    res.json({ nextNumber: `Machine-${paddedNum}` });
}));

/**
 * GET /api/machines/gazanas
 * Get list of distinct gazana values for filtering
 */
router.get('/gazanas', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const results = await db('Machine')
        .distinct('gazana_machine')
        .whereNotNull('gazana_machine')
        .andWhere('gazana_machine', '!=', '')
        .orderBy('gazana_machine', 'asc');

    const gazanas = results.map(r => r.gazana_machine);
    res.json({ data: gazanas });
}));

/**
 * GET /api/machines/workload
 * Summary for Machine List (Totals)
 * Includes ongoing contracts count, assigned stitches, produced, and remaining (pending)
 */
router.get('/workload', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Aggregate from ContractItemMachine - only ongoing (active) contracts
    const workloadFixed = await db('ContractItemMachine')
        .join('ContractItem', 'ContractItemMachine.ContractItemID', 'ContractItem.ContractItemID')
        .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
        .where('Contract.IsActive', 1)
        .select('ContractItemMachine.MachineID')
        .countDistinct('Contract.ContractID as ongoingContractsCount')
        .sum('ContractItemMachine.assigned_stitches as totalAssigned')
        .sum('ContractItemMachine.pending_stitches as totalPending')
        .select(db.raw("SUM(CASE WHEN ContractItemMachine.status = 'Delayed' THEN 1 ELSE 0 END) as delayedCount"))
        .groupBy('ContractItemMachine.MachineID');

    const formatted = workloadFixed.map((w: any) => ({
        machineId: w.MachineID,
        ongoingContractsCount: Number(w.ongoingContractsCount || 0),
        totalAssigned: Number(w.totalAssigned || 0),
        totalPending: Number(w.totalPending || 0),
        totalProduced: Number(w.totalAssigned || 0) - Number(w.totalPending || 0),
        hasDelays: Number(w.delayedCount || 0) > 0
    }));

    res.json({ data: formatted });
}));

/**
 * GET /api/machines/:id/workload
 * Detailed breakdown for a specific machine
 */
router.get('/:id/workload', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const machineId = parseInt(req.params.id);

    const items = await db('ContractItemMachine')
        .join('ContractItem', 'ContractItemMachine.ContractItemID', 'ContractItem.ContractItemID')
        .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
        .where('ContractItemMachine.MachineID', machineId)
        .where('Contract.IsActive', 1)
        .select(
            'ContractItemMachine.*',
            'Contract.ContractNo',
            'Contract.ContractDate as contractDate',
            'ContractItem.ItemDescription',
            'ContractItem.ContractItemID',
            'ContractItem.Collection'
        );

    // For each item, we need actual_days_used (calculated from ProductionEntry)
    // We can run a parallel query or Promise.all. 
    // Since per-machine item count is low (usually < 20 active), Promise.all is fine.

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const detailedItems = await Promise.all(items.map(async (item: any) => {
        const stats = await db('ProductionEntry')
            .where({ ContractItemID: item.ContractItemID, MachineID: machineId })
            .min('ProductionDate as firstDate')
            .max('ProductionDate as lastDate')
            .sum('Stitches as produced')
            .first();

        // Actual Days = days elapsed since contract start (with respect to contract)
        const contractStart = item.contractDate ? new Date(item.contractDate) : null;
        contractStart?.setHours(0, 0, 0, 0);
        const actualDays = contractStart
            ? Math.max(0, Math.ceil((today.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

        const assigned = Number(item.assigned_stitches || 0);
        const pending = Number(item.pending_stitches || 0);
        const completedStitches = assigned - pending;
        const avgStitches = Number(item.avg_stitches_per_day || 0);
        const estimatedDays = Number(item.estimated_days || 0);
        const onTimeStatus = (estimatedDays > 0 && actualDays <= estimatedDays) ? 'On Time' : 'Delayed';
        const daysLeft = estimatedDays > 0 ? Math.max(0, Math.ceil(estimatedDays) - actualDays) : null;

        return {
            contractItemId: item.ContractItemID,
            itemDescription: item.ItemDescription,
            collection: item.Collection,
            contractNo: item.ContractNo,
            contractDate: item.contractDate,
            assigned_stitches: assigned,
            completed_stitches: completedStitches,
            pending_stitches: pending,
            avg_stitches_per_day: avgStitches,
            estimated_days: estimatedDays,
            days_left: daysLeft,
            first_production_date: stats?.firstDate || null,
            last_production_date: stats?.lastDate || null,
            actual_days_used: actualDays,
            status: item.status || 'Open',
            on_time_status: onTimeStatus,
            completed_at: item.completed_at
        };
    }));

    res.json({ data: detailedItems });
}));

/**
 * POST /api/machines
 * Create a new machine
 */
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { machineNumber, masterName, status, gazanaMachine } = req.body;

    // Validation
    if (!machineNumber || !masterName) {
        return res.status(400).json({ message: 'Machine Number and Master Name are required' });
    }

    // Check if exists
    const existing = await db('Machine').where('MachineNumber', machineNumber).first();
    if (existing) {
        return res.status(409).json({ message: `Machine ${machineNumber} already exists` });
    }

    // Auto-assign Master Machine Number
    const masterMachineNumber = await getNextMasterMachineNumber(masterName);

    const [id] = await db('Machine').insert({
        MachineNumber: machineNumber,
        MasterName: masterName,
        master_machine_number: masterMachineNumber,
        Status: status || 'idle',
        gazana_machine: gazanaMachine,
        IsActive: 1
    }).returning('MachineID');

    const newMachine = await db('Machine').where('MachineID', typeof id === 'object' ? id.MachineID : id).first();

    res.status(201).json({
        message: 'Machine created successfully',
        data: {
            id: newMachine.MachineID,
            machineNumber: newMachine.MachineNumber,
            masterName: newMachine.MasterName,
            masterMachineNumber: newMachine.master_machine_number,
            status: newMachine.Status,
            gazanaMachine: newMachine.gazana_machine,
            isActive: newMachine.IsActive
        }
    });
}));

/**
 * PUT /api/machines/:id
 * Update a machine
 */
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const { masterName, status, isActive, machineNumber, gazanaMachine } = req.body;

    const updates: any = {}; // Fix for UpdatedAt error: remove column update
    if (status !== undefined) updates.Status = status;
    if (isActive !== undefined) updates.IsActive = isActive;
    if (gazanaMachine !== undefined) updates.gazana_machine = gazanaMachine;

    // Handle Master Change
    if (masterName !== undefined) {
        // Fetch current master to see if it changed
        const current = await db('Machine').where('MachineID', id).select('MasterName').first();
        if (current && current.MasterName !== masterName) {
            updates.MasterName = masterName;
            updates.master_machine_number = await getNextMasterMachineNumber(masterName);
        }
    }

    // Handle Machine Number Change
    if (machineNumber !== undefined) {
        // Check if new number already exists for a DIFFERENT machine
        const existing = await db('Machine')
            .where('MachineNumber', machineNumber)
            .andWhereNot('MachineID', id)
            .first();

        if (existing) {
            return res.status(409).json({ message: `Machine ${machineNumber} already exists` });
        }
        updates.MachineNumber = machineNumber;
    }

    await db('Machine').where('MachineID', id).update(updates);

    const updated = await db('Machine').where('MachineID', id).first();

    res.json({
        message: 'Machine updated successfully',
        data: {
            id: updated.MachineID,
            machineNumber: updated.MachineNumber,
            masterName: updated.MasterName,
            masterMachineNumber: updated.master_machine_number,
            status: updated.Status,
            gazanaMachine: updated.gazana_machine,
            isActive: updated.IsActive
        }
    });
}));

/**
 * DELETE /api/machines/:id
 * Delete a machine
 */
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);

    // 1. Check for Production Records
    const productionCount = await db('ProductionEntry').where('MachineID', id).count('ProductionID as count').first();
    if (productionCount && Number(productionCount.count) > 0) {
        return res.status(409).json({
            message: 'Cannot delete machine. It is associated with active production records.'
        });
    }

    // 2. Check for Contracts (if ContractMachine table exists)
    try {
        const contractCount = await db('ContractMachine').where('MachineID', id).count('ContractID as count').first();
        if (contractCount && Number(contractCount.count) > 0) {
            return res.status(409).json({
                message: 'Cannot delete machine. It is assigned to active contracts.'
            });
        }
    } catch (error) {
        console.warn('Skipping ContractMachine check (table might not exist):', error);
    }

    await db('Machine').where('MachineID', id).del();
    res.json({ message: 'Machine deleted successfully' });
}));

export { router as machinesRouter };

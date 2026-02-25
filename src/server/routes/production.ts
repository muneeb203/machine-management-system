import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../../database/connection';
import { recalculateMachineWorkload } from '../../services/workload';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/production/daily/:date
 * Get daily production for all machines
 */
router.get('/daily/:date', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const date = req.params.date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const entries = await db('ProductionEntry')
    .join('Machine', 'ProductionEntry.MachineID', 'Machine.MachineID')
    .join('ContractItem', 'ProductionEntry.ContractItemID', 'ContractItem.ContractItemID')
    .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
    .where('ProductionEntry.ProductionDate', date)
    .select(
      'ProductionEntry.*',
      'Machine.MachineNumber',
      'Machine.MasterName',
      'Machine.master_machine_number', // NEW
      'Contract.ContractNo',
      // 'Contract.PartyName', // Removed - column does not exist in schema
      'ContractItem.ItemDescription',
      'ContractItem.Color',
      // 'ContractItem.DesignNo' // Removed - column does not exist in schema
    )
    .orderBy(['Machine.MachineNumber', 'ProductionEntry.Shift']);

  // Transform to frontend friendly format
  const formatted = entries.map(entry => ({
    id: entry.ProductionID,
    machine: {
      id: entry.MachineID,
      machineNumber: entry.MachineNumber,
      masterName: entry.MasterName,
      masterMachineNumber: entry.master_machine_number, // NEW
    },
    contract: {
      contractNo: entry.ContractNo,
      poNumber: entry.PONumber, // Assuming from join
    },
    item: {
      id: entry.ContractItemID,
      description: entry.ItemDescription,
      color: entry.Color,
    },
    shift: entry.Shift,
    stitches: entry.Stitches,
    repeats: entry.Repeats,
    operatorName: entry.OperatorName,
    notes: entry.Notes,
  }));

  res.json({ data: formatted });
}));

/**
 * POST /api/production/entry
 * Create a single production entry
 */
router.post('/entry', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    machineId,
    contractItemId,
    productionDate,
    shift,
    stitches,
    repeats,
    operatorName,
    notes
  } = req.body;

  // Validation
  if (!machineId || !contractItemId || !productionDate || !shift || stitches === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 1. Get Contract Item Limits
  const contractItem = await db('ContractItem')
    .select('Stitch', 'Repeat', 'ItemDescription')
    .where('ContractItemID', contractItemId)
    .first();

  if (!contractItem) {
    return res.status(404).json({ error: 'Contract Item not found' });
  }

  // Parse limits (Stitch is stored as string in some versions, Repeat as Decimal)
  const maxStitches = parseFloat(contractItem.Stitch || '0');
  const maxRepeats = parseFloat(contractItem.Repeat || '0');

  // 2. Calculate Existing Usage
  const usage = await db('ProductionEntry')
    .where('ContractItemID', contractItemId)
    .sum('Stitches as totalStitches')
    .sum('Repeats as totalRepeats')
    .first();

  const currentStitches = usage?.totalStitches || 0;
  const currentRepeats = usage?.totalRepeats || 0;

  // 3. Calculate New Totals for informational/status purposes
  const newTotalStitches = Number(currentStitches) + Number(stitches);
  const newTotalRepeats = Number(currentRepeats) + Number(repeats || 0);

  // Status tracking (optional, logic removed from blocking)
  const isStitchExceeded = maxStitches > 0 && newTotalStitches > maxStitches;
  const isRepeatExceeded = maxRepeats > 0 && newTotalRepeats > maxRepeats;

  // 4. Insert if Valid
  const [id] = await db('ProductionEntry').insert({
    MachineID: machineId,
    ContractItemID: contractItemId,
    ProductionDate: productionDate,
    Shift: shift,
    Stitches: stitches,
    Repeats: repeats || 0,
    OperatorName: operatorName,
    Notes: notes,
    Created_at: new Date(),
    Updated_at: new Date()
  }).returning('ProductionID');

  const newEntry = await db('ProductionEntry').where('ProductionID', typeof id === 'object' ? id.ProductionID : id).first();

  // 5. Trigger Workload Recalculation
  await recalculateMachineWorkload(contractItemId, machineId);

  res.status(201).json({
    message: 'Production entry created',
    data: newEntry
  });
}));

/**
 * GET /api/production/contracts/by-machine/:machineId
 * Contracts/items assigned to a specific machine (ContractItemMachine).
 * Used for Daily Production dropdown - backend filtering only.
 */
router.get('/contracts/by-machine/:machineId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const machineId = parseInt(req.params.machineId, 10);
  if (isNaN(machineId) || machineId <= 0) {
    return res.status(400).json({ error: 'Invalid machine ID' });
  }

  const items = await db('ContractItem')
    .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
    .join('ContractItemMachine', 'ContractItem.ContractItemID', 'ContractItemMachine.ContractItemID')
    .where('ContractItemMachine.MachineID', machineId)
    .leftJoin(db.raw(`(
        SELECT ContractItemID, SUM(Stitches) as UsedStitches, SUM(Repeats) as UsedRepeats
        FROM (
            SELECT ContractItemID, Stitches, Repeats FROM ProductionEntry
            UNION ALL
            SELECT contract_item_id as ContractItemID, total_stitches as Stitches, 0 as Repeats FROM daily_production_master
        ) as combined
        GROUP BY ContractItemID
    ) as usage`), 'ContractItem.ContractItemID', 'usage.ContractItemID')
    .where('Contract.IsActive', 1)
    .select(
      'Contract.ContractNo',
      'Contract.PONumber',
      'ContractItem.*',
      db.raw('(SELECT GROUP_CONCAT(CONCAT(MachineID, ":", pending_stitches)) FROM ContractItemMachine WHERE ContractItemMachine.ContractItemID = ContractItem.ContractItemID) as machinePending'),
      'usage.UsedStitches',
      'usage.UsedRepeats'
    )
    .orderBy('Contract.ContractNo', 'desc');

  const formattedItems = items.map((item: any) => ({
    ...item,
    UsedStitches: Number(item.UsedStitches || 0),
    UsedRepeats: Number(item.UsedRepeats || 0)
  }));

  res.json({ data: formattedItems });
}));

/**
 * GET /api/production/contracts
 * Helper to get active contracts/items for dropdown (all, unfiltered)
 */
router.get('/contracts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Return contracts and their items with usage stats
  const items = await db('ContractItem')
    .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
    .leftJoin(db.raw(`(
        SELECT ContractItemID, SUM(Stitches) as UsedStitches, SUM(Repeats) as UsedRepeats
        FROM (
            SELECT ContractItemID, Stitches, Repeats FROM ProductionEntry
            UNION ALL
            SELECT contract_item_id as ContractItemID, total_stitches as Stitches, 0 as Repeats FROM daily_production_master
        ) as combined
        GROUP BY ContractItemID
    ) as usage`), 'ContractItem.ContractItemID', 'usage.ContractItemID')
    .select(
      'Contract.ContractNo',
      'Contract.PONumber',
      'ContractItem.*',
      db.raw('(SELECT GROUP_CONCAT(CONCAT(MachineID, ":", pending_stitches)) FROM ContractItemMachine WHERE ContractItemMachine.ContractItemID = ContractItem.ContractItemID) as machinePending'),
      'usage.UsedStitches',
      'usage.UsedRepeats'
    )
    .orderBy('Contract.ContractNo', 'desc');

  // Parse sums to ensure they are numbers (Knex/Driver might return strings for sums)
  const formattedItems = items.map(item => ({
    ...item,
    UsedStitches: Number(item.UsedStitches || 0),
    UsedRepeats: Number(item.UsedRepeats || 0)
  }));

  // Fetch Assigned Machines for these contracts
  const contractIds = [...new Set((items as any[]).map(i => i.ContractID))];
  const assignments = await db('ContractMachine')
    .whereIn('ContractID', contractIds)
    .select('ContractID', 'MachineID');

  // Map ContractID -> MachineID[]
  const machineMap: Record<number, number[]> = {};
  assignments.forEach((a: any) => {
    if (!machineMap[a.ContractID]) machineMap[a.ContractID] = [];
    machineMap[a.ContractID].push(a.MachineID);
  });

  // Attach to items
  const finalItems = formattedItems.map((item: any) => ({
    ...item,
    AssignedMachineIDs: machineMap[item.ContractID] || []
  }));

  res.json({ data: finalItems });
}));


/**
 * PUT /api/production/:id
 * Update a production entry
 */
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const {
    productionDate,
    shift,
    stitches,
    repeats,
    operatorName,
    notes
  } = req.body;

  // 1. Fetch Existing Entry to get ContractItemID and previous values
  const existingEntry = await db('ProductionEntry')
    .where('ProductionID', id)
    .first();

  if (!existingEntry) {
    return res.status(404).json({ error: 'Production entry not found' });
  }

  // 2. Calculate Diffs
  // If values are not provided in body, assume no change (use existing)
  const newStitches = stitches !== undefined ? Number(stitches) : Number(existingEntry.Stitches);
  const newRepeats = repeats !== undefined ? Number(repeats) : Number(existingEntry.Repeats);

  const diffStitches = newStitches - Number(existingEntry.Stitches);
  const diffRepeats = newRepeats - Number(existingEntry.Repeats || 0);

  // 3. Calculate Projected Totals for informational/status purposes
  const contractItemId = existingEntry.ContractItemID;
  const contractItem = await db('ContractItem').select('Stitch', 'Repeat').where('ContractItemID', contractItemId).first();

  let maxStitches = 0;
  let maxRepeats = 0;
  let projectedTotalStitches = newStitches;
  let projectedTotalRepeats = newRepeats;

  if (contractItem) {
    maxStitches = parseFloat(contractItem.Stitch || '0');
    maxRepeats = parseFloat(contractItem.Repeat || '0');

    const usage = await db('ProductionEntry')
      .where('ContractItemID', contractItemId)
      .sum('Stitches as totalStitches')
      .sum('Repeats as totalRepeats')
      .first();

    const currentTotalStitches = Number(usage?.totalStitches || 0);
    const currentTotalRepeats = Number(usage?.totalRepeats || 0);

    projectedTotalStitches = currentTotalStitches + diffStitches;
    projectedTotalRepeats = currentTotalRepeats + diffRepeats;
  }

  const isStitchExceeded = maxStitches > 0 && projectedTotalStitches > maxStitches;
  const isRepeatExceeded = maxRepeats > 0 && projectedTotalRepeats > maxRepeats;

  // 4. Update
  await db('ProductionEntry')
    .where('ProductionID', id)
    .update({
      ProductionDate: productionDate || existingEntry.ProductionDate,
      Shift: shift || existingEntry.Shift,
      Stitches: newStitches,
      Repeats: newRepeats,
      OperatorName: operatorName || existingEntry.OperatorName,
      Notes: notes !== undefined ? notes : existingEntry.Notes,
      Updated_at: new Date()
    });

  const updatedEntry = await db('ProductionEntry').where('ProductionID', id).first();

  // 5. Trigger Workload Recalculation
  // existingEntry keys are capitalized in DB result usually, but check standard knex format.
  // The fetch above: .select('*') implicitly or .first()
  // Recalculate for the item/machine associated with this entry
  if (existingEntry) {
    await recalculateMachineWorkload(existingEntry.ContractItemID, existingEntry.MachineID);
  }

  res.json({
    message: 'Production entry updated',
    data: updatedEntry
  });
}));

export { router as productionRouter };
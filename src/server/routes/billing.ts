import { Router } from 'express';
import { authenticateToken, requireOperator, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { RateEngine } from '../../services/RateEngine';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/billing/contract-yards/:contractId
 * Get contract total yards from Contract Section 2 (ContractItem.Yards) and cumulative sent yards
 */
router.get('/contract-yards/:contractId', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const contractId = parseInt(req.params.contractId, 10);
  if (isNaN(contractId)) {
    return res.status(400).json({ error: 'Invalid contract ID' });
  }

  let totalYards = 0;
  let cumulativeSentYards = 0;

  // Total yards from Contract Section 2 (ContractItem.Yards)
  try {
    const totalResult = await db('ContractItem')
      .where('ContractID', contractId)
      .sum(db.raw('COALESCE(Yards, 0) as total'))
      .first();
    totalYards = Number(totalResult?.total ?? (totalResult as any)?.Total ?? 0);
  } catch (e1) {
    try {
      const totalResult = await db('ContractItem')
        .where('ContractID', contractId)
        .sum(db.raw('COALESCE(yards, 0) as total'))
        .first();
      totalYards = Number(totalResult?.total ?? (totalResult as any)?.Total ?? 0);
    } catch (e2) {
      console.error('contract-yards totalYards:', e1);
    }
  }

  try {
    const dailySent = await db('daily_billing_records')
      .where('contract_id', contractId)
      .sum(db.raw('COALESCE(sent_yards, 0) as total'))
      .first();
    cumulativeSentYards = Number(dailySent?.total ?? (dailySent as any)?.Total ?? 0);
  } catch (e) {
    console.error('contract-yards dailySent:', e);
  }

  try {
    const billSent = await db('bill')
      .where('contract_id', contractId)
      .sum(db.raw('COALESCE(sent_yards, 0) as total'))
      .first();
    cumulativeSentYards += Number(billSent?.total ?? (billSent as any)?.Total ?? 0);
  } catch {
    // bill.sent_yards column may not exist if migration not run
  }

  const remainingYards = Math.max(0, totalYards - cumulativeSentYards);

  res.json({
    data: {
      totalYards,
      cumulativeSentYards,
      remainingYards,
    },
  });
}));

/**
 * GET /api/billing/daily/:date
 * Get daily billing records
 */
router.get('/daily/:date', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const date = req.params.date;

  const billingRecords = await db('daily_billing_records')
    .join('Machine', 'daily_billing_records.machine_id', 'Machine.MachineID')
    .join('MachineMaster', 'daily_billing_records.master_id', 'MachineMaster.MasterID')
    .leftJoin('Contract', 'daily_billing_records.contract_id', 'Contract.ContractID')
    .where('daily_billing_records.billing_date', date)
    .select(
      'daily_billing_records.*',
      'Machine.MachineNumber as machine_number',
      'MachineMaster.Name as master_name',
      'Contract.ContractNo as contract_number',
      'Contract.PONumber as po_number'
    )
    .orderBy('daily_billing_records.created_at', 'desc');

  res.json({ data: billingRecords });
}));

/**
 * POST /api/billing/daily
 * Create optimized daily billing record (machine-wise, shift-wise)
 */
router.post('/daily', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const { machineId, masterId, contractId, billingDate, designs, totalAmount, sentYards } = req.body;

  if (!machineId || !masterId || !billingDate || !designs || designs.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sentYardsNum = Number(sentYards || 0);
  let remainingYards: number | null = null;

  if (contractId && sentYardsNum > 0) {
    const totalResult = await db('ContractItem').where('ContractID', contractId).sum(db.raw('COALESCE(Yards, 0) as total')).first();
    const totalYards = Number(totalResult?.total || 0);
    const sentResult = await db('daily_billing_records').where('contract_id', contractId).sum(db.raw('COALESCE(sent_yards, 0) as total')).first();
    const cumulativeBefore = Number(sentResult?.total || 0);
    remainingYards = Math.max(0, totalYards - cumulativeBefore - sentYardsNum);
  }

  // Start transaction
  const trx = await db.transaction();

  try {
    // Create main billing record
    const [billingRecordId] = await trx('daily_billing_records').insert({
      machine_id: machineId,
      master_id: masterId,
      contract_id: contractId || null,
      billing_date: billingDate,
      total_amount: totalAmount,
      sent_yards: contractId ? sentYardsNum : null,
      remaining_yards: remainingYards,
      status: 'draft',
      created_by: req.user!.id,
      created_at: new Date(),
    });

    // Create individual shift records for each design
    const shiftRecords = [];

    for (const design of designs) {
      // Day shift record (if has data)
      if (design.dayShift.stitchesDone > 0) {
        shiftRecords.push({
          billing_record_id: billingRecordId,
          design_no: design.designNo,
          d_stitch: design.dStitch,
          shift: 'day',
          stitches_done: design.dayShift.stitchesDone,
          fabric: design.dayShift.fabric,
          rate: design.dayShift.rate,
          per_yds: design.dayShift.perYds,
          amount: design.dayShift.amount,
        });
      }

      // Night shift record (if has data)
      if (design.nightShift.stitchesDone > 0) {
        shiftRecords.push({
          billing_record_id: billingRecordId,
          design_no: design.designNo,
          d_stitch: design.dStitch,
          shift: 'night',
          stitches_done: design.nightShift.stitchesDone,
          fabric: design.nightShift.fabric,
          rate: design.nightShift.rate,
          per_yds: design.nightShift.perYds,
          amount: design.nightShift.amount,
        });
      }
    }

    if (shiftRecords.length > 0) {
      await trx('daily_billing_shift_records').insert(shiftRecords);
    }

    await trx.commit();

    // Fetch the complete record with all joined data for immediate return
    const savedRecord = await db('daily_billing_records')
      .join('Machine', 'daily_billing_records.machine_id', 'Machine.MachineID')
      .join('MachineMaster', 'daily_billing_records.master_id', 'MachineMaster.MasterID')
      .leftJoin('Contract', 'daily_billing_records.contract_id', 'Contract.ContractID')
      .where('daily_billing_records.id', billingRecordId)
      .select(
        'daily_billing_records.*',
        'Machine.MachineNumber',
        'MachineMaster.Name as masterName',
        'Contract.ContractNo as contractNumber',
        'Contract.PONumber as poNumber'
      )
      .first();

    // Calculate day and night stitches for the response
    const dayStitches = shiftRecords
      .filter(s => s.shift === 'day')
      .reduce((sum, s) => sum + s.stitches_done, 0);

    const nightStitches = shiftRecords
      .filter(s => s.shift === 'night')
      .reduce((sum, s) => sum + s.stitches_done, 0);

    const designNos = Array.from(new Set(shiftRecords.map(s => s.design_no))).join(', ');

    const responseData = {
      ...savedRecord,
      dayStitches,
      nightStitches,
      totalStitches: dayStitches + nightStitches,
      designNos
    };

    res.status(201).json({
      message: 'Daily billing record created successfully',
      data: responseData
    });

  } catch (error) {
    await trx.rollback();
    throw error;
  }
}));

/**
 * GET /api/billing/daily/:date/machine/:machineId
 * Get billing record for specific machine and date
 */
router.get('/daily/:date/machine/:machineId', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const { date, machineId } = req.params;

  const billingRecord = await db('daily_billing_records')
    .join('Machine', 'daily_billing_records.machine_id', 'Machine.MachineID')
    .join('MachineMaster', 'daily_billing_records.master_id', 'MachineMaster.MasterID')
    .where({
      'daily_billing_records.billing_date': date,
      'daily_billing_records.machine_id': machineId
    })
    .select(
      'daily_billing_records.*',
      'Machine.MachineNumber',
      'Machine.gazana_machine',
      'MachineMaster.Name as masterName'
    )
    .first();

  if (!billingRecord) {
    return res.json({ data: null });
  }

  // Get shift records
  const shiftRecords = await db('daily_billing_shift_records')
    .where('billing_record_id', billingRecord.id)
    .orderBy(['design_no', 'shift']);

  // Group by design
  const designsMap = new Map();

  shiftRecords.forEach(record => {
    if (!designsMap.has(record.design_no)) {
      designsMap.set(record.design_no, {
        designNo: record.design_no,
        dStitch: record.d_stitch,
        dayShift: { stitchesDone: 0, fabric: 0, rate: 0, perYds: 0, amount: 0 },
        nightShift: { stitchesDone: 0, fabric: 0, rate: 0, perYds: 0, amount: 0 },
      });
    }

    const design = designsMap.get(record.design_no);
    const shiftKey = record.shift === 'day' ? 'dayShift' : 'nightShift';

    design[shiftKey] = {
      stitchesDone: record.stitches_done,
      fabric: record.fabric,
      rate: record.rate,
      perYds: record.per_yds,
      amount: record.amount,
    };
  });

  const designs = Array.from(designsMap.values());

  res.json({
    data: {
      ...billingRecord,
      designs
    }
  });
}));

/**
 * POST /api/billing/approve/:id
 * Approve billing record (makes it immutable)
 */
router.post('/approve/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const billingRecordId = parseInt(req.params.id);

  await RateEngine.approveBillingRecord(billingRecordId, req.user!.id);

  res.json({ message: 'Billing record approved successfully' });
}));

/**
 * GET /api/billing/history
 * Get recent daily billing records with details
 */
router.get('/history', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const limit = parseInt(req.query.limit as string) || 50;

  const history = await db('daily_billing_records')
    .join('Machine', 'daily_billing_records.machine_id', 'Machine.MachineID')
    .join('MachineMaster', 'daily_billing_records.master_id', 'MachineMaster.MasterID')
    .leftJoin('Contract', 'daily_billing_records.contract_id', 'Contract.ContractID')
    .select(
      'daily_billing_records.*',
      'Machine.MachineNumber',
      'MachineMaster.Name as masterName',
      'Contract.ContractNo as contractNumber',
      'Contract.PONumber as poNumber'
    )
    .orderBy('daily_billing_records.billing_date', 'desc')
    .orderBy('daily_billing_records.created_at', 'desc')
    .limit(limit);

  // For each record, get its designs/shifts summary if needed, 
  // but for the main table we might just need the totals already in daily_billing_records.
  // Actually, the user asked for "Day Stitches" and "Night Stitches".
  // So we need to compute those.

  const historyWithStitches = await Promise.all(history.map(async (record) => {
    const shifts = await db('daily_billing_shift_records')
      .where('billing_record_id', record.id)
      .select('shift', 'stitches_done', 'design_no');

    const dayStitches = shifts
      .filter(s => s.shift === 'day')
      .reduce((sum, s) => sum + s.stitches_done, 0);

    const nightStitches = shifts
      .filter(s => s.shift === 'night')
      .reduce((sum, s) => sum + s.stitches_done, 0);

    const designNos = Array.from(new Set(shifts.map(s => s.design_no))).join(', ');

    return {
      ...record,
      dayStitches,
      nightStitches,
      totalStitches: dayStitches + nightStitches,
      designNos
    };
  }));

  res.json({ data: historyWithStitches });
}));

/**
 * GET /api/billing/daily/history/details/:id
 * Get full internal shift details for a billing record
 */
router.get('/daily/history/details/:id', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const billingRecordId = parseInt(req.params.id);

  const details = await db('daily_billing_shift_records')
    .where('billing_record_id', billingRecordId)
    .orderBy(['design_no', 'shift']);

  res.json({ data: details });
}));

/**
 * GET /api/billing/record/:id
 * Get full billing record by ID for editing (header + designs with shift data)
 */
router.get('/record/:id', asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const record = await db('daily_billing_records')
    .join('Machine', 'daily_billing_records.machine_id', 'Machine.MachineID')
    .join('MachineMaster', 'daily_billing_records.master_id', 'MachineMaster.MasterID')
    .leftJoin('Contract', 'daily_billing_records.contract_id', 'Contract.ContractID')
    .where('daily_billing_records.id', id)
    .select(
      'daily_billing_records.*',
      'Machine.MachineNumber',
      'Machine.MachineID',
      'Machine.gazana_machine',
      'MachineMaster.Name as masterName',
      'MachineMaster.MasterID',
      'Contract.ContractNo as contractNumber',
      'Contract.ContractID',
      'Contract.PONumber as poNumber'
    )
    .first();

  if (!record) return res.status(404).json({ error: 'Record not found' });

  const shiftRecords = await db('daily_billing_shift_records')
    .where('billing_record_id', id)
    .orderBy(['design_no', 'shift']);

  const designsMap = new Map();
  shiftRecords.forEach((s: any) => {
    if (!designsMap.has(s.design_no)) {
      designsMap.set(s.design_no, {
        designNo: s.design_no,
        dStitch: Number(s.d_stitch),
        dayShift: { stitchesDone: 0, fabric: 0, rate: 0, perYds: 0, amount: 0 },
        nightShift: { stitchesDone: 0, fabric: 0, rate: 0, perYds: 0, amount: 0 },
      });
    }
    const design = designsMap.get(s.design_no);
    const key = s.shift === 'day' ? 'dayShift' : 'nightShift';
    design[key] = {
      stitchesDone: Number(s.stitches_done),
      fabric: Number(s.fabric),
      rate: Number(s.rate),
      perYds: Number(s.per_yds),
      amount: Number(s.amount),
    };
  });

  const designs = Array.from(designsMap.values());

  res.json({
    data: {
      ...record,
      designs,
    },
  });
}));

/**
 * PUT /api/billing/record/:id
 * Update a daily billing record (designs/shift data)
 */
router.put('/record/:id', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res: any) => {
  const id = parseInt(req.params.id);
  const { designs, totalAmount, sentYards } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  if (!designs || !Array.isArray(designs) || designs.length === 0) {
    return res.status(400).json({ error: 'Designs are required' });
  }

  const existing = await db('daily_billing_records').where('id', id).first();
  if (!existing) return res.status(404).json({ error: 'Record not found' });
  if (existing.status === 'approved') {
    return res.status(400).json({ error: 'Cannot edit approved record' });
  }

  const sentYardsNum = Number(sentYards ?? existing.sent_yards ?? 0);
  let remainingYards: number | null = null;
  const contractId = existing.contract_id;

  if (contractId && sentYardsNum >= 0) {
    const totalResult = await db('ContractItem').where('ContractID', contractId).sum(db.raw('COALESCE(Yards, 0) as total')).first();
    const totalYards = Number(totalResult?.total || 0);
    const sentResult = await db('daily_billing_records')
      .where('contract_id', contractId)
      .whereNot('id', id)
      .sum(db.raw('COALESCE(sent_yards, 0) as total'))
      .first();
    const cumulativeOther = Number(sentResult?.total || 0);
    remainingYards = Math.max(0, totalYards - cumulativeOther - sentYardsNum);
  }

  const trx = await db.transaction();
  try {
    await trx('daily_billing_shift_records').where('billing_record_id', id).del();

    const shiftRecords = [];
    for (const design of designs) {
      if (design.dayShift?.stitchesDone > 0) {
        shiftRecords.push({
          billing_record_id: id,
          design_no: design.designNo,
          d_stitch: design.dStitch,
          shift: 'day',
          stitches_done: design.dayShift.stitchesDone,
          fabric: design.dayShift.fabric,
          rate: design.dayShift.rate,
          per_yds: design.dayShift.perYds,
          amount: design.dayShift.amount,
        });
      }
      if (design.nightShift?.stitchesDone > 0) {
        shiftRecords.push({
          billing_record_id: id,
          design_no: design.designNo,
          d_stitch: design.dStitch,
          shift: 'night',
          stitches_done: design.nightShift.stitchesDone,
          fabric: design.nightShift.fabric,
          rate: design.nightShift.rate,
          per_yds: design.nightShift.perYds,
          amount: design.nightShift.amount,
        });
      }
    }

    if (shiftRecords.length > 0) {
      await trx('daily_billing_shift_records').insert(shiftRecords);
    }

    const newTotal = totalAmount ?? shiftRecords.reduce((sum, s) => sum + Number(s.amount), 0);
    const updatePayload: any = { total_amount: newTotal };
    if (contractId !== null && contractId !== undefined) {
      updatePayload.sent_yards = sentYardsNum;
      updatePayload.remaining_yards = remainingYards;
    }
    await trx('daily_billing_records').where('id', id).update(updatePayload);

    await trx.commit();

    const updated = await db('daily_billing_records')
      .join('Machine', 'daily_billing_records.machine_id', 'Machine.MachineID')
      .join('MachineMaster', 'daily_billing_records.master_id', 'MachineMaster.MasterID')
      .leftJoin('Contract', 'daily_billing_records.contract_id', 'Contract.ContractID')
      .where('daily_billing_records.id', id)
      .select(
        'daily_billing_records.*',
        'Machine.MachineNumber',
        'MachineMaster.Name as masterName',
        'Contract.ContractNo as contractNumber',
        'Contract.PONumber as poNumber'
      )
      .first();

    const shifts = await db('daily_billing_shift_records').where('billing_record_id', id);
    const dayStitches = shifts.filter((s: any) => s.shift === 'day').reduce((sum, s) => sum + s.stitches_done, 0);
    const nightStitches = shifts.filter((s: any) => s.shift === 'night').reduce((sum, s) => sum + s.stitches_done, 0);
    const designNos = [...new Set(shifts.map((s: any) => s.design_no))].join(', ');

    res.json({
      message: 'Billing record updated successfully',
      data: {
        ...updated,
        dayStitches,
        nightStitches,
        totalStitches: dayStitches + nightStitches,
        designNos,
      },
    });
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}));

export { router as billingRouter };
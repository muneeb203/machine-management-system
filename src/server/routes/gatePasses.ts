import { Router } from 'express';
import { authenticateToken, requireInventoryClerk, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db, withTransaction, logAudit } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/gate-passes
 * Get all gate passes with pagination
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;

  let query = db('gate_passes')
    .leftJoin('contracts', 'gate_passes.contract_id', 'contracts.id')
    .whereNull('gate_passes.deleted_at');

  if (status) {
    query = query.where('gate_passes.status', status);
  }

  const total = await query.clone().count('gate_passes.id as count').first();

  const gatePasses = await query
    .select(
      'gate_passes.*',
      'contracts.contract_number'
    )
    .orderBy('gate_passes.created_at', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data: gatePasses,
    pagination: {
      page,
      limit,
      total: parseInt(total?.count || '0'),
      totalPages: Math.ceil(parseInt(total?.count || '0') / limit),
    },
  });
}));

/**
 * POST /api/gate-passes
 * Create new gate pass
 */
router.post('/', requireInventoryClerk, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const {
    gatePassNumber,
    partyName,
    poNumber,
    contractId,
    passType,
    totalGazana,
    passDate,
  } = req.body;

  const gatePass = await withTransaction(async (trx) => {
    // Check if gate pass number already exists
    const existing = await trx('gate_passes')
      .where('gate_pass_number', gatePassNumber)
      .whereNull('deleted_at')
      .first();

    if (existing) {
      throw new Error('Gate pass number already exists');
    }

    const [inserted] = await trx('gate_passes')
      .insert({
        gate_pass_number: gatePassNumber,
        party_name: partyName,
        po_number: poNumber,
        contract_id: contractId,
        pass_type: passType,
        total_gazana: totalGazana,
        pass_date: new Date(passDate),
        status: 'pending',
        created_by: req.user!.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Create inventory movement
    await trx('inventory_movements').insert({
      gate_pass_id: inserted.id,
      movement_type: passType,
      gazana_quantity: totalGazana,
      movement_date: new Date(passDate),
      created_by: req.user!.id,
      created_at: new Date(),
    });

    await logAudit('gate_passes', inserted.id, 'insert', null, inserted, req.user!.id);

    return inserted;
  });

  res.status(201).json({ data: gatePass });
}));

/**
 * PUT /api/gate-passes/:id/finalize
 * Finalize gate pass and trigger billing
 */
router.put('/:id/finalize', requireInventoryClerk, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const gatePassId = parseInt(req.params.id);

  await withTransaction(async (trx) => {
    const gatePass = await trx('gate_passes')
      .where('id', gatePassId)
      .whereNull('deleted_at')
      .first();

    if (!gatePass) {
      throw new Error('Gate pass not found');
    }

    if (gatePass.status === 'finalized') {
      throw new Error('Gate pass is already finalized');
    }

    // Check if all linked production is complete
    if (gatePass.contract_id) {
      const incompleteProduction = await trx('production_entries')
        .join('designs', 'production_entries.design_id', 'designs.id')
        .where('designs.contract_id', gatePass.contract_id)
        .where('production_entries.is_billed', false)
        .whereNull('production_entries.deleted_at')
        .count('production_entries.id as count')
        .first();

      if (parseInt(incompleteProduction?.count || '0') > 0) {
        throw new Error('Cannot finalize gate pass: incomplete production entries exist');
      }
    }

    const oldValues = { ...gatePass };

    // Update gate pass status
    await trx('gate_passes')
      .where('id', gatePassId)
      .update({
        status: 'finalized',
        finalized_by: req.user!.id,
        finalized_at: new Date(),
        updated_at: new Date(),
      });

    // Mark related production as billed
    if (gatePass.contract_id) {
      await trx('production_entries')
        .join('designs', 'production_entries.design_id', 'designs.id')
        .where('designs.contract_id', gatePass.contract_id)
        .update({ is_billed: true });
    }

    await logAudit(
      'gate_passes',
      gatePassId,
      'update',
      oldValues,
      { ...oldValues, status: 'finalized' },
      req.user!.id
    );
  });

  res.json({ message: 'Gate pass finalized successfully. Related production marked as billed.' });
}));

/**
 * GET /api/gate-passes/inventory-summary
 * Get current inventory summary
 */
router.get('/inventory-summary', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const summary = await db('inventory_movements')
    .join('gate_passes', 'inventory_movements.gate_pass_id', 'gate_passes.id')
    .where('gate_passes.status', 'finalized')
    .groupBy('gate_passes.party_name')
    .select(
      'gate_passes.party_name',
      db.raw(`
        SUM(CASE WHEN inventory_movements.movement_type = 'in' 
            THEN inventory_movements.gazana_quantity 
            ELSE 0 END) as total_received
      `),
      db.raw(`
        SUM(CASE WHEN inventory_movements.movement_type = 'out' 
            THEN inventory_movements.gazana_quantity 
            ELSE 0 END) as total_consumed
      `),
      db.raw(`
        SUM(CASE WHEN inventory_movements.movement_type = 'in' 
            THEN inventory_movements.gazana_quantity 
            ELSE -inventory_movements.gazana_quantity END) as remaining_gazana
      `)
    )
    .orderBy('gate_passes.party_name');

  res.json({ data: summary });
}));

export { router as gatePassRouter };
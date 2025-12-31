import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/reports/dashboard
 * Get dashboard statistics
 */
router.get('/dashboard', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const today = new Date().toISOString().split('T')[0];

  const [
    machineStats,
    todayProduction,
    pendingBilling,
    activeContracts,
  ] = await Promise.all([
    // Machine statistics
    db('machines')
      .select(
        db.raw('COUNT(*) as total_machines'),
        db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_machines')
      )
      .first(),

    // Today's production
    db('production_entries')
      .where('production_date', today)
      .whereNull('deleted_at')
      .sum('actual_stitches as total_stitches')
      .first(),

    // Pending billing
    db('billing_records')
      .where('is_approved', false)
      .count('id as count')
      .first(),

    // Active contracts
    db('contracts')
      .where('status', 'active')
      .whereNull('deleted_at')
      .count('id as count')
      .first(),
  ]);

  res.json({
    data: {
      totalMachines: parseInt(machineStats?.total_machines || '0'),
      activeMachines: parseInt(machineStats?.active_machines || '0'),
      todayProduction: parseInt(todayProduction?.total_stitches || '0'),
      pendingBilling: parseInt(pendingBilling?.count || '0'),
      activeContracts: parseInt(activeContracts?.count || '0'),
    },
  });
}));

/**
 * GET /api/reports/machine-production
 * Machine production report for date range
 */
router.get('/machine-production', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  const report = await db('production_entries')
    .join('machines', 'production_entries.machine_id', 'machines.id')
    .join('billing_records', function() {
      this.on('billing_records.machine_id', '=', 'production_entries.machine_id')
        .andOn('billing_records.billing_date', '=', 'production_entries.production_date')
        .andOn('billing_records.shift', '=', 'production_entries.shift');
    })
    .whereBetween('production_entries.production_date', [startDate, endDate])
    .whereNull('production_entries.deleted_at')
    .groupBy([
      'machines.id',
      'machines.machine_number',
      'machines.master_group',
      'production_entries.shift'
    ])
    .select(
      'machines.machine_number',
      'machines.master_group',
      'production_entries.shift',
      db.raw('SUM(production_entries.actual_stitches) as total_stitches'),
      db.raw('SUM(billing_records.total_amount) as total_amount'),
      db.raw('COUNT(DISTINCT production_entries.production_date) as working_days')
    )
    .orderBy(['machines.machine_number', 'production_entries.shift']);

  res.json({ data: report });
}));

/**
 * GET /api/reports/contract-profitability
 * Contract profitability report
 */
router.get('/contract-profitability', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  let query = db('billing_records')
    .join('contracts', 'billing_records.contract_id', 'contracts.id')
    .groupBy(['contracts.id', 'contracts.contract_number', 'contracts.party_name'])
    .select(
      'contracts.id as contract_id',
      'contracts.contract_number',
      'contracts.party_name',
      db.raw('SUM(billing_records.total_stitches) as total_stitches'),
      db.raw('SUM(billing_records.total_amount) as total_billing'),
      db.raw('COUNT(billing_records.id) as billing_entries')
    );

  if (startDate && endDate) {
    query = query.whereBetween('billing_records.billing_date', [startDate, endDate]);
  }

  const report = await query.orderBy('total_billing', 'desc');

  res.json({ data: report });
}));

/**
 * GET /api/reports/inventory-status
 * Current inventory status report
 */
router.get('/inventory-status', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const report = await db('gate_passes')
    .leftJoin('inventory_movements', 'gate_passes.id', 'inventory_movements.gate_pass_id')
    .where('gate_passes.status', 'finalized')
    .whereNull('gate_passes.deleted_at')
    .groupBy(['gate_passes.party_name'])
    .select(
      'gate_passes.party_name',
      db.raw(`
        SUM(CASE WHEN gate_passes.pass_type = 'in' 
            THEN gate_passes.total_gazana 
            ELSE 0 END) as total_received
      `),
      db.raw(`
        SUM(CASE WHEN gate_passes.pass_type = 'out' 
            THEN gate_passes.total_gazana 
            ELSE 0 END) as total_shipped
      `),
      db.raw(`
        SUM(CASE WHEN gate_passes.pass_type = 'in' 
            THEN gate_passes.total_gazana 
            ELSE -gate_passes.total_gazana END) as remaining_gazana
      `)
    )
    .orderBy('remaining_gazana', 'desc');

  res.json({ data: report });
}));

/**
 * GET /api/reports/audit-trail
 * Audit trail report with filters
 */
router.get('/audit-trail', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const tableName = req.query.tableName as string;
  const action = req.query.action as string;
  const userId = req.query.userId as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  let query = db('audit_logs')
    .leftJoin('users', 'audit_logs.user_id', 'users.id')
    .select(
      'audit_logs.*',
      'users.username'
    );

  if (tableName) {
    query = query.where('audit_logs.table_name', tableName);
  }

  if (action) {
    query = query.where('audit_logs.action', action);
  }

  if (userId) {
    query = query.where('audit_logs.user_id', userId);
  }

  if (startDate && endDate) {
    query = query.whereBetween('audit_logs.created_at', [startDate, endDate]);
  }

  const total = await query.clone().count('audit_logs.id as count').first();

  const auditLogs = await query
    .orderBy('audit_logs.created_at', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data: auditLogs,
    pagination: {
      page,
      limit,
      total: parseInt(total?.count || '0'),
      totalPages: Math.ceil(parseInt(total?.count || '0') / limit),
    },
  });
}));

/**
 * GET /api/reports/override-summary
 * Stitch override summary report
 */
router.get('/override-summary', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  let query = db('stitch_overrides')
    .join('production_entries', 'stitch_overrides.production_entry_id', 'production_entries.id')
    .join('machines', 'production_entries.machine_id', 'machines.id')
    .join('designs', 'production_entries.design_id', 'designs.id')
    .join('contracts', 'designs.contract_id', 'contracts.id')
    .join('users', 'stitch_overrides.override_by', 'users.id')
    .select(
      'stitch_overrides.*',
      'machines.machine_number',
      'contracts.contract_number',
      'designs.design_number',
      'users.username',
      'production_entries.production_date'
    );

  if (startDate && endDate) {
    query = query.whereBetween('stitch_overrides.override_at', [startDate, endDate]);
  }

  const overrides = await query.orderBy('stitch_overrides.override_at', 'desc');

  res.json({ data: overrides });
}));

export { router as reportsRouter };
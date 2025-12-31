import { Router } from 'express';
import { authenticateToken, requireOperator, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { RateEngine } from '../../services/RateEngine';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/billing/daily/:date
 * Get daily billing records
 */
router.get('/daily/:date', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const date = req.params.date;
  
  const billingRecords = await db('billing_records')
    .join('contracts', 'billing_records.contract_id', 'contracts.id')
    .join('machines', 'billing_records.machine_id', 'machines.id')
    .where('billing_records.billing_date', date)
    .select(
      'billing_records.*',
      'contracts.contract_number',
      'contracts.party_name',
      'machines.machine_number',
      'machines.master_group'
    )
    .orderBy(['machines.machine_number', 'billing_records.shift']);

  res.json({ data: billingRecords });
}));

/**
 * POST /api/billing/approve/:id
 * Approve billing record (makes it immutable)
 */
router.post('/approve/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const billingRecordId = parseInt(req.params.id);
  
  await RateEngine.approveBillingRecord(billingRecordId, req.user!.id);
  
  res.json({ message: 'Billing record approved successfully' });
}));

/**
 * GET /api/billing/summary
 * Get billing summary for date range
 */
router.get('/summary', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const contractId = req.query.contractId as string;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  let query = db('billing_records')
    .join('contracts', 'billing_records.contract_id', 'contracts.id')
    .join('machines', 'billing_records.machine_id', 'machines.id')
    .whereBetween('billing_records.billing_date', [startDate, endDate]);

  if (contractId) {
    query = query.where('billing_records.contract_id', contractId);
  }

  const summary = await query
    .groupBy([
      'contracts.id',
      'contracts.contract_number',
      'contracts.party_name',
      'machines.machine_number',
      'billing_records.shift'
    ])
    .select(
      'contracts.contract_number',
      'contracts.party_name',
      'machines.machine_number',
      'billing_records.shift',
      db.raw('SUM(billing_records.total_stitches) as total_stitches'),
      db.raw('SUM(billing_records.total_amount) as total_amount'),
      db.raw('COUNT(billing_records.id) as record_count')
    )
    .orderBy(['contracts.contract_number', 'machines.machine_number']);

  res.json({ data: summary });
}));

export { router as billingRouter };
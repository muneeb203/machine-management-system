import { Router } from 'express';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { ProductionService } from '../../services/ProductionService';
import { validateProductionEntry, validateStitchOverride, validateBulkProduction } from '../validators/productionValidators';
import { db } from '../../database/connection';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/production/daily/:date
 * Get daily production for all machines
 */
router.get('/daily/:date', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const date = req.params.date;
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const entries = await ProductionService.getDailyProduction(date);
  res.json({ data: entries });
}));

/**
 * POST /api/production/entry
 * Create a single production entry
 */
router.post('/entry', requireOperator, validateProductionEntry, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const entry = await ProductionService.createProductionEntry(req.body, req.user!.id);
  res.status(201).json({ data: entry });
}));

/**
 * POST /api/production/bulk
 * Create multiple production entries (for 22 machines daily entry)
 */
router.post('/bulk', requireOperator, validateBulkProduction, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { entries } = req.body;
  const results = await ProductionService.createBulkProductionEntries(entries, req.user!.id);
  res.status(201).json({ 
    data: results,
    message: `Successfully created ${results.length} production entries`
  });
}));

/**
 * POST /api/production/override-stitch
 * Override stitch count with audit trail
 */
router.post('/override-stitch', requireOperator, validateStitchOverride, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const override = await ProductionService.overrideStitchCount(req.body, req.user!.id);
  res.status(201).json({ 
    data: override,
    message: 'Stitch count overridden successfully. Billing has been recalculated.'
  });
}));

/**
 * GET /api/production/entry/:id
 * Get production entry with override history
 */
router.get('/entry/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const entryId = parseInt(req.params.id);
  const entry = await ProductionService.getProductionWithOverrides(entryId);

  if (!entry) {
    return res.status(404).json({ error: 'Production entry not found' });
  }

  res.json({ data: entry });
}));

/**
 * GET /api/production/summary
 * Get production summary by machine for date range
 */
router.get('/summary', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  // Validate date formats
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const summary = await ProductionService.getProductionSummary(startDate, endDate);
  res.json({ data: summary });
}));

/**
 * GET /api/production/machines
 * Get all machines with their current status
 */
router.get('/machines', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const machines = await db('machines')
    .where('is_active', true)
    .orderBy('machine_number');

  res.json({ 
    data: machines.map(machine => ({
      id: machine.id,
      machineNumber: machine.machine_number,
      masterGroup: machine.master_group,
      dayShiftCapacity: machine.day_shift_capacity,
      nightShiftCapacity: machine.night_shift_capacity,
      isActive: machine.is_active,
      createdAt: machine.created_at,
    }))
  });
}));

/**
 * GET /api/production/designs/active
 * Get all active designs for production entry
 */
router.get('/designs/active', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const designs = await db('designs')
    .join('contracts', 'designs.contract_id', 'contracts.id')
    .where('designs.status', 'in_progress')
    .whereNull('designs.deleted_at')
    .whereNull('contracts.deleted_at')
    .where('contracts.status', 'active')
    .select(
      'designs.id',
      'designs.design_number',
      'designs.component',
      'designs.planned_quantity',
      'designs.planned_stitch_count',
      'contracts.id as contract_id',
      'contracts.contract_number',
      'contracts.party_name'
    )
    .orderBy(['contracts.contract_number', 'designs.design_number']);

  res.json({ data: designs });
}));

export { router as productionRouter };
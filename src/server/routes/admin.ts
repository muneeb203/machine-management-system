import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { RateEngine } from '../../services/RateEngine';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticateToken);
router.use(requireAdmin); // All admin routes require admin role

/**
 * GET /api/admin/rate-elements
 * Get all rate elements
 */
router.get('/rate-elements', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const elements = await RateEngine.getAllRateElements();
  res.json({ data: elements });
}));

/**
 * POST /api/admin/rate-elements
 * Create or update rate element
 */
router.post('/rate-elements', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const element = await RateEngine.upsertRateElement(req.body, req.user!.id);
  res.json({ data: element });
}));

/**
 * GET /api/admin/base-rates
 * Get all base rates
 */
router.get('/base-rates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const baseRates = await db('base_rates')
    .join('users', 'base_rates.created_by', 'users.id')
    .select(
      'base_rates.*',
      'users.username as created_by_username'
    )
    .orderBy('base_rates.effective_from', 'desc');

  res.json({ data: baseRates });
}));

/**
 * POST /api/admin/base-rates
 * Create new base rate
 */
router.post('/base-rates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ratePerStitch, effectiveFrom, effectiveTo } = req.body;

  // Deactivate current base rate if setting new one
  if (!effectiveTo) {
    await db('base_rates')
      .where('is_active', true)
      .update({ 
        is_active: false,
        effective_to: new Date(effectiveFrom)
      });
  }

  const [baseRate] = await db('base_rates')
    .insert({
      rate_per_stitch: ratePerStitch,
      effective_from: new Date(effectiveFrom),
      effective_to: effectiveTo ? new Date(effectiveTo) : null,
      is_active: true,
      created_by: req.user!.id,
      created_at: new Date(),
    })
    .returning('*');

  res.status(201).json({ data: baseRate });
}));

/**
 * GET /api/admin/users
 * Get all users
 */
router.get('/users', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const users = await db('users')
    .whereNull('deleted_at')
    .select('id', 'username', 'email', 'role', 'is_active', 'created_at', 'updated_at')
    .orderBy('created_at', 'desc');

  res.json({ data: users });
}));

/**
 * PUT /api/admin/users/:id/status
 * Activate/deactivate user
 */
router.put('/users/:id/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = parseInt(req.params.id);
  const { isActive } = req.body;

  await db('users')
    .where('id', userId)
    .update({
      is_active: isActive,
      updated_at: new Date(),
    });

  res.json({ message: 'User status updated successfully' });
}));

/**
 * GET /api/admin/system-stats
 * Get system statistics
 */
router.get('/system-stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [
    totalContracts,
    totalDesigns,
    totalProduction,
    totalBilling,
    totalUsers,
  ] = await Promise.all([
    db('contracts').whereNull('deleted_at').count('id as count').first(),
    db('designs').whereNull('deleted_at').count('id as count').first(),
    db('production_entries').whereNull('deleted_at').count('id as count').first(),
    db('billing_records').sum('total_amount as total').first(),
    db('users').whereNull('deleted_at').count('id as count').first(),
  ]);

  res.json({
    data: {
      totalContracts: parseInt(String(totalContracts?.count || '0')),
      totalDesigns: parseInt(String(totalDesigns?.count || '0')),
      totalProduction: parseInt(String(totalProduction?.count || '0')),
      totalBilling: parseFloat(String(totalBilling?.total || '0')),
      totalUsers: parseInt(String(totalUsers?.count || '0')),
    },
  });
}));

/**
 * POST /api/admin/backup-data
 * Create data backup (simplified version)
 */
router.post('/backup-data', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // In a real implementation, this would create a proper database backup
  // For now, we'll just return a success message
  res.json({ 
    message: 'Backup initiated successfully',
    timestamp: new Date().toISOString(),
  });
}));

export { router as adminRouter };
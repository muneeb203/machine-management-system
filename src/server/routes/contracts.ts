import { Router } from 'express';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { ContractService } from '../../services/ContractService';
import { validateContract, validateDesign } from '../validators/contractValidators';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/contracts
 * Get all contracts with pagination and filtering
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const partyName = req.query.partyName as string;

  const result = await ContractService.getAllContracts(page, limit, status, partyName);

  res.json({
    data: result.contracts,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  });
}));

/**
 * POST /api/contracts
 * Create a new contract
 */
router.post('/', requireOperator, validateContract, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const contract = await ContractService.createContract(req.body, req.user!.id);
  res.status(201).json({ data: contract });
}));

/**
 * GET /api/contracts/:id
 * Get contract by ID
 */
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const contractId = parseInt(req.params.id);
  const contract = await ContractService.getContractById(contractId);

  if (!contract) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  res.json({ data: contract });
}));

/**
 * PUT /api/contracts/:id/status
 * Update contract status
 */
router.put('/:id/status', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const contractId = parseInt(req.params.id);
  const { status } = req.body;

  if (!['active', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  await ContractService.updateContractStatus(contractId, status, req.user!.id);
  res.json({ message: 'Contract status updated successfully' });
}));

/**
 * GET /api/contracts/:id/designs
 * Get all designs for a contract
 */
router.get('/:id/designs', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const contractId = parseInt(req.params.id);
  const designs = await ContractService.getDesignsByContract(contractId);
  res.json({ data: designs });
}));

/**
 * POST /api/contracts/:id/designs
 * Create a new design for a contract
 */
router.post('/:id/designs', requireOperator, validateDesign, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const contractId = parseInt(req.params.id);
  const designData = { ...req.body, contractId };

  const design = await ContractService.createDesign(designData, req.user!.id);
  res.status(201).json({ data: design });
}));

/**
 * GET /api/contracts/designs/:designId
 * Get design by ID with rate elements
 */
router.get('/designs/:designId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const designId = parseInt(req.params.designId);
  const design = await ContractService.getDesignById(designId);

  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }

  res.json({ data: design });
}));

/**
 * PUT /api/contracts/designs/:designId/status
 * Update design status
 */
router.put('/designs/:designId/status', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const designId = parseInt(req.params.designId);
  const { status } = req.body;

  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  await ContractService.updateDesignStatus(designId, status, req.user!.id);
  res.json({ message: 'Design status updated successfully' });
}));

/**
 * GET /api/contracts/search
 * Search contracts and designs
 */
router.get('/search', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const searchTerm = req.query.q as string;

  if (!searchTerm || searchTerm.length < 2) {
    return res.status(400).json({ error: 'Search term must be at least 2 characters' });
  }

  const results = await ContractService.searchContractsAndDesigns(searchTerm);
  res.json({ data: results });
}));

export { router as contractRouter };
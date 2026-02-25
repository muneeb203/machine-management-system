import { Router } from 'express';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { ContractService } from '../../services/ContractService';
import { validateContract, validateDesign } from '../validators/contractValidators';
import { db } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// 1. Literal routes (Static)
/**
 * GET /api/contracts/next-number
 * Get the next available sequential contract number
 */
router.get('/next-number', asyncHandler(async (req, res) => {
  logger.info('[CONTRACTS] Fetching next available contract number');
  try {
    const nextNo = await ContractService.getNextContractNumber();
    logger.info(`[CONTRACTS] Next contract number generated: ${nextNo}`);
    res.json({ data: nextNo });
  } catch (error) {
    logger.error('[CONTRACTS] Failed to generate next number:', error);
    res.status(500).json({ error: 'Failed to generate next contract number' });
  }
}));

// 2. Collection routes
/**
 * GET /api/contracts
 * Get all contracts with pagination and filtering
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const partyName = req.query.partyName as string;
  const poNumber = req.query.poNumber as string;
  const collection = req.query.collection as string;
  const search = req.query.search as string;

  const result = await ContractService.getAllContracts(page, limit, status, partyName, poNumber, collection, search);

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
router.post('/', requireOperator, validateContract, async (req: AuthenticatedRequest, res, next) => {
  try {
    console.log('[DEBUG] POST /contracts - Start');
    console.log('Creating contract with payload:', JSON.stringify(req.body, null, 2));
    const contract = await ContractService.createContract(req.body, req.user!.id);
    console.log('[DEBUG] POST /contracts - Success, ID:', contract);
    res.status(201).json({ data: contract });
  } catch (error: any) {
    console.error('FAILED TO CREATE CONTRACT:', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      return res.status(409).json({ error: { message: `Contract Number '${req.body.contractNumber}' already exists. Please use a unique Contract Number.` } });
    }
    next(error);
  }
});

/**
 * POST /api/contracts/temp
 * Create a TEMPORARY contract
 */
/**
 * POST /api/contracts/temp
 * Create a TEMPORARY contract
 */
router.post('/temp', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res) => {
  console.log('Creating TEMP contract with payload:', JSON.stringify(req.body, null, 2));
  const result = await ContractService.createTempContract(req.body, req.user!.id);
  res.status(201).json({ data: result });
}));

/**
 * PUT /api/contracts/:id/finalize
 * Finalize a TEMP contract
 */
router.put('/:id/finalize', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const contractId = parseInt(req.params.id);
  console.log(`Finalizing contract ${contractId} with payload:`, JSON.stringify(req.body, null, 2));
  const result = await ContractService.finalizeContract(contractId, req.body, req.user!.id);
  res.json({ data: result, message: 'Contract finalized successfully' });
}));



/**
 * POST /api/contracts
 * Create a new contract
 */

// NEW: Lookup Items for Dropdowns (Collection / Design (PO))
router.get('/items-lookup', async (req, res) => {
  try {
    const items = await db('ContractItem')
      .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
      .where('Contract.IsActive', 1)
      .distinct(
        'ContractItem.Collection',
        'ContractItem.DesignNo',
        'Contract.PONumber',
        'Contract.ContractID'
      )
      .whereNotNull('ContractItem.Collection')
      .orderBy('ContractItem.Collection');

    res.json({ data: items });
  } catch (error) {
    console.error('Error fetching lookup items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

/**
 * GET /api/contracts/dropdown-items
 * Get contract items formatted for dropdown selection
 * Includes both contracts with items and contracts without items
 */
router.get('/dropdown-items', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const search = req.query.search as string;
  const limit = parseInt(req.query.limit as string) || 50;
  const machineId = req.query.machineId ? parseInt(req.query.machineId as string, 10) : null;

  // First, get contracts with items
  let itemsQuery = db('ContractItem')
    .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
    .where('Contract.IsActive', 1);

  // Filter by machine: only items assigned to this machine (ContractItemMachine)
  if (machineId && !isNaN(machineId)) {
    itemsQuery = itemsQuery
      .join('ContractItemMachine', 'ContractItem.ContractItemID', 'ContractItemMachine.ContractItemID')
      .where('ContractItemMachine.MachineID', machineId);
  }

  itemsQuery = itemsQuery.select(
      'ContractItem.ContractItemID as itemId',
      'Contract.ContractID as contractId',
      'Contract.ContractNo as contractNumber',
      'Contract.PONumber as poNumber',
      'Contract.PONumber as partyName', // Using PONumber as party name for now
      'Contract.ContractDate as contractDate',
      'ContractItem.Collection as collection',
      'ContractItem.DesignNo as designNo',
      'ContractItem.Component as component',
      'ContractItem.ItemDescription as itemDescription',
      'ContractItem.Fabric as fabric',
      'ContractItem.Color as color',
      'ContractItem.Rate_per_Stitch as ratePerStitch',
      db.raw('1 as hasItems')
    );

  // Second, get contracts without items (skip when filtering by machine - those have no machine assignment)
  let contractsQuery = db('Contract')
    .leftJoin('ContractItem', 'Contract.ContractID', 'ContractItem.ContractID')
    .where('Contract.IsActive', 1)
    .whereNull('ContractItem.ContractID') // Only contracts without items
    .select(
      db.raw('NULL as itemId'),
      'Contract.ContractID as contractId',
      'Contract.ContractNo as contractNumber',
      'Contract.PONumber as poNumber',
      'Contract.PONumber as partyName', // Using PONumber as party name for now
      'Contract.ContractDate as contractDate',
      db.raw('NULL as collection'),
      db.raw('NULL as designNo'),
      db.raw('NULL as component'),
      db.raw('NULL as itemDescription'),
      db.raw('NULL as fabric'),
      db.raw('NULL as color'),
      db.raw('NULL as ratePerStitch'),
      db.raw('0 as hasItems')
    );

  // Add search functionality to both queries
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    
    itemsQuery = itemsQuery.where(function() {
      this.where('Contract.ContractNo', 'like', searchTerm)
        .orWhere('Contract.PONumber', 'like', searchTerm)
        .orWhere('ContractItem.Collection', 'like', searchTerm)
        .orWhere('ContractItem.DesignNo', 'like', searchTerm)
        .orWhere('ContractItem.Component', 'like', searchTerm)
        .orWhere('ContractItem.ItemDescription', 'like', searchTerm);
    });

    contractsQuery = contractsQuery.where(function() {
      this.where('Contract.ContractNo', 'like', searchTerm)
        .orWhere('Contract.PONumber', 'like', searchTerm);
    });
  }

  // Execute both queries (when machineId provided, skip contracts without items - they have no machine assignment)
  const [itemsResults, contractsResults] = await Promise.all([
    itemsQuery.orderBy('Contract.ContractNo', 'desc')
      .orderBy('ContractItem.Collection')
      .orderBy('ContractItem.DesignNo'),
    machineId && !isNaN(machineId) ? Promise.resolve([]) : contractsQuery.orderBy('Contract.ContractNo', 'desc')
  ]);

  // Combine results and apply limit
  const allResults = [...itemsResults, ...(Array.isArray(contractsResults) ? contractsResults : [])].slice(0, limit);

  res.json({ data: allResults });
}));

/**
 * GET /api/contracts/list-items
 * Get contracts with items flattened for list view (one row per contract item)
 * Columns: contract no, date, po number, collection, design no, component, stitch, rate, repeat, pieces, yards, total amount
 */
router.get('/list-items', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 1000;
  const status = (req.query.status as string) || 'all';

  // Use ContractItem as base (INNER join) - ensures we get item-level data for Component, Stitch, Rate, etc.
  let query = db('ContractItem')
    .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
    .select(
      'Contract.ContractID as contractId',
      'Contract.ContractNo as contractNumber',
      'Contract.ContractDate as contractDate',
      'Contract.PONumber as poNumber',
      'ContractItem.ContractItemID as itemId',
      'ContractItem.Collection as collection',
      'ContractItem.DesignNo as designNo',
      'ContractItem.Component as component',
      'ContractItem.Stitch as stitch',
      'ContractItem.Rate_per_Stitch as rate',
      'ContractItem.Repeat as repeat',
      'ContractItem.Pieces as pieces',
      db.raw('COALESCE(ContractItem.Yards, 0) as yards'),
      'ContractItem.Total_Rate as totalAmount',
      db.raw(`(
        SELECT COALESCE(SUM(cim.estimated_days), 0)
        FROM ContractItem ci2
        JOIN ContractItemMachine cim ON ci2.ContractItemID = cim.ContractItemID
        WHERE ci2.ContractID = Contract.ContractID
      ) as totalEstimatedDays`)
    )
    .orderBy('Contract.ContractID', 'desc')
    .orderBy('ContractItem.ContractItemID', 'asc')
    .limit(limit);

  // Filter by IsActive
  if (status === 'inactive') {
    query = query.where('Contract.IsActive', 0);
  } else if (status === 'active') {
    query = query.where('Contract.IsActive', 1);
  }

  const rows = await query;

  res.json({ data: rows });
}));

// ... removed from here to top

/**
 * GET /api/contracts/:id
 * Get contract by ID - Strictly numeric ID to avoid route collision
 */
router.get('/:id(\\d+)', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const contractId = parseInt(req.params.id);
  const contract = await ContractService.getContractById(contractId);

  if (!contract) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  res.json({ data: contract });
}));

/**
 * PUT /api/contracts/:id
 * Update an existing contract
 */
router.put('/:id', requireOperator, validateContract, async (req: AuthenticatedRequest, res, next) => {
  try {
    const contractId = parseInt(req.params.id);
    console.log(`Updating contract ${contractId} with payload:`, JSON.stringify(req.body, null, 2));

    await ContractService.updateContract(contractId, req.body, req.user!.id);

    // Fetch updated contract to return
    const updatedContract = await ContractService.getContractById(contractId);
    res.json({ data: updatedContract, message: 'Contract updated successfully' });
  } catch (error) {
    console.error(`FAILED TO UPDATE CONTRACT ${req.params.id}:`, error);
    next(error);
  }
});

/**
 * PUT /api/contracts/:id/draft
 * Auto-save a draft contract
 */
router.put('/:id/draft', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const contractId = parseInt(req.params.id);
  await ContractService.updateDraft(contractId, req.body, req.user!.id);
  res.json({ message: 'Draft saved' });
}));

/**
 * DELETE /api/contracts/:id
 * Soft delete a contract
 */
router.delete('/:id', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const contractId = parseInt(req.params.id);
  await ContractService.deleteContract(contractId, req.user!.id);
  res.json({ message: 'Contract deleted successfully' });
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
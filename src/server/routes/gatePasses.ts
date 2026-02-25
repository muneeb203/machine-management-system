import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db, withTransaction, logAudit } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/gate-passes
 * Get all gate passes with pagination and filtering
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const type = req.query.type as string; // Inward or Outward
  const status = req.query.status as string;
  const collection = req.query.collection as string;

  // 1. Base Query (Joins & Filters only)
  // Don't add SELECT or ORDER BY here to keep the count query clean
  let baseQuery = db('GatePass')
    .leftJoin('Contract', 'GatePass.ContractID', 'Contract.ContractID');

  if (type) {
    baseQuery = baseQuery.where('GatePass.Type', type);
  }
  if (status) {
    baseQuery = baseQuery.where('GatePass.Status', status);
  }
  if (collection) {
    baseQuery = baseQuery.whereExists(function () {
      this.select('*')
        .from('ContractItem')
        .whereRaw('ContractItem.ContractID = Contract.ContractID')
        .andWhere('ContractItem.Collection', 'like', `%${collection}%`);
    });
  }

  // 2. Count Total (Clean query, no random selects)
  const totalResult = await baseQuery.clone().count('GatePass.GatePassID as count').first();
  const total = parseInt(String(totalResult?.count || '0'));

  // 3. Fetch Data (Apply selects, sorts, pagination)
  const data = await baseQuery
    .select(
      'GatePass.*',
      'Contract.ContractNo'
    )
    .orderBy('GatePass.PassDate', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

/**
 * GET /api/gate-passes/:id
 * Get single gate pass with items
 */
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);

  const gatePass = await db('GatePass')
    .leftJoin('Contract', 'GatePass.ContractID', 'Contract.ContractID')
    .where('GatePass.GatePassID', id)
    .select('GatePass.*', 'Contract.ContractNo', 'Contract.PONumber')
    .first();

  if (!gatePass) {
    return res.status(404).json({ error: 'Gate Pass not found' });
  }

  const items = await db('GatePassItem').where('GatePassID', id);

  res.json({ data: { ...gatePass, items } });
}));

/**
 * POST /api/gate-passes
 * Create new gate pass
 */
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const {
    type, // 'Inward' | 'Outward'
    passDate,
    contractId,
    carrierName,
    vehicleNumber,
    driverName,
    remarks,
    items // Array of { description, quantity, unit, itemType }
  } = req.body;

  if (!type || !passDate || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Generate a simple Pass Number (e.g., GP-{Year}-{Random})
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const passNumber = `GP-${type.substring(0, 3).toUpperCase()}-${year}-${random}`;

  const result = await withTransaction(async (trx) => {
    const [gatePassId] = await trx('GatePass').insert({
      PassNumber: passNumber,
      Type: type,
      PassDate: passDate,
      ContractID: contractId || null,
      CarrierName: carrierName,
      VehicleNumber: vehicleNumber,
      DriverName: driverName,
      Status: 'Draft',
      Remarks: remarks,
      CreatedBy: req.user!.id,
    });

    // Handle MySQL return value (array with insertId)
    const newGatePassId = gatePassId;

    // Insert Items
    if (items && items.length > 0) {
      const gatePassItems = items.map((item: any) => ({
        GatePassID: newGatePassId,
        ItemType: item.itemType,
        Description: item.description || '', // Fallback if description is empty/not provided
        Quantity: item.quantity,
        Unit: item.unit,
        Collection: item.collection,
        DesignNo: item.designNo,
        Component: item.component,
        Repeat: item.repeat || null,
        ItemRemarks: item.itemRemarks || null,
        Yards: item.yards || 0 // Updated to Yards
      }));

      await trx('GatePassItem').insert(gatePassItems);
    }

    return newGatePassId; // Return ID
  });

  // Fetch newly created
  const id = result;

  res.status(201).json({ message: 'Gate Pass created', id });
}));

// Replace existing PUT status with generic PUT for update AND status?
// Or keep separate? The existing PUT /:id/status is specific.
// I will separate the Full Update PUT /:id from PUT /:id/status or merge them?
// Generally PUT /:id implies full resource update. I will implement a Full Update handler.

/**
 * DELETE /api/gate-passes/:id
 * Delete a gate pass and its items
 */
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);

  await withTransaction(async (trx) => {
    // Items cascade delete usually, but let's be explicit if needed or rely on DB FK
    // If FK is set to ON DELETE CASCADE, deleting parent is enough.
    // If not, delete items first. Assuming standard setup, let's delete items first to be safe.
    await trx('GatePassItem').where('GatePassID', id).del();
    const deleted = await trx('GatePass').where('GatePassID', id).del();

    if (!deleted) {
      throw new Error('Gate Pass not found or already deleted');
    }
  });

  res.json({ message: 'Gate Pass deleted successfully' });
}));

/**
 * PUT /api/gate-passes/:id
 * Update an existing gate pass (Header + Items)
 */
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const {
    passDate,
    contractId,
    carrierName,
    vehicleNumber,
    driverName,
    remarks,
    items,
    type // Should type be editable? Probably not, but let's allow basic edits.
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Items are required' });
  }

  await withTransaction(async (trx) => {
    // 1. Update Header
    const updateFields: any = {
      PassDate: passDate,
      ContractID: contractId || null,
      CarrierName: carrierName,
      VehicleNumber: vehicleNumber,
      DriverName: driverName,
      Remarks: remarks,
      updated_at: new Date()
    };
    if (type) updateFields.Type = type;

    const updated = await trx('GatePass').where('GatePassID', id).update(updateFields);
    if (!updated) {
      // If no rows updated, check if it exists
      const exists = await trx('GatePass').where('GatePassID', id).first();
      if (!exists) throw new Error('Gate Pass not found');
    }

    // 2. Replace Items (Delete All + Insert New)
    await trx('GatePassItem').where('GatePassID', id).del();

    const gatePassItems = items.map((item: any) => ({
      GatePassID: id,
      ItemType: item.itemType,
      Description: item.description || '',
      Quantity: item.quantity,
      Unit: item.unit,
      Collection: item.collection,
      DesignNo: item.designNo,
      Component: item.component,
      Repeat: item.repeat || null,
      ItemRemarks: item.itemRemarks || null,
      Yards: item.yards || 0 // Updated to Yards
    }));

    await trx('GatePassItem').insert(gatePassItems);
  });

  res.json({ message: 'Gate Pass updated successfully' });
}));

/**
 * PUT /api/gate-passes/:id/status
 * Update status (e.g., Approve, Complete)
 */
router.put('/:id/status', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;

  if (!['Draft', 'Approved', 'Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  await db('GatePass')
    .where('GatePassID', id)
    .update({ Status: status, updated_at: new Date() });

  res.json({ message: 'Status updated' });
}));

export { router as gatePassRouter };
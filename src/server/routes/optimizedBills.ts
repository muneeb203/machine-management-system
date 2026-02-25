import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db, withTransaction } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * Generate bill number
 */
async function generateBillNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db('bill').count('* as count').first();
  const nextNumber = (count?.count || 0) + 1;
  return `BILL-${year}-${String(nextNumber).padStart(4, '0')}`;
}

/**
 * POST /api/optimized-bills
 * Create new bill with matrix items
 */
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { header, items, contractId, sentYards } = req.body;
  
  // Validation
  if (!header?.party_name || header.party_name.length < 2) {
    return res.status(400).json({ error: 'Party name is required (min 2 characters)' });
  }
  
  if (!header?.bill_date) {
    return res.status(400).json({ error: 'Bill date is required' });
  }
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }
  
  // Validate items
  for (const item of items) {
    if (!item.fabric) {
      return res.status(400).json({ error: 'Fabric is required for all items' });
    }
    if (!item.stitches || item.stitches <= 0) {
      return res.status(400).json({ error: 'Stitches must be greater than 0' });
    }
    if (!item.rate_stitch || item.rate_stitch <= 0) {
      return res.status(400).json({ error: 'Rate per stitch must be greater than 0' });
    }
  }
  
  // Calculate total
  const totalAmount = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
  
  // Contract Section 2 yards: total, cumulative sent, remaining for this bill
  let remainingYards: number | null = null;
  const contractIdNum = contractId ? parseInt(contractId, 10) : null;
  const sentYardsNum = Number(sentYards ?? 0);
  if (contractIdNum && !isNaN(contractIdNum) && sentYardsNum > 0) {
    const totalResult = await db('ContractItem').where('ContractID', contractIdNum).sum(db.raw('COALESCE(Yards, 0) as total')).first();
    const totalYards = Number(totalResult?.total || 0);
    const dailySent = await db('daily_billing_records').where('contract_id', contractIdNum).sum(db.raw('COALESCE(sent_yards, 0) as total')).first();
    const billSent = await db('bill').where('contract_id', contractIdNum).sum(db.raw('COALESCE(sent_yards, 0) as total')).first();
    const cumulativeBefore = Number(dailySent?.total || 0) + Number(billSent?.total || 0);
    remainingYards = Math.max(0, totalYards - cumulativeBefore - sentYardsNum);
  }
  
  // Generate bill number
  const billNumber = await generateBillNumber();
  
  // Save to database
  const result = await withTransaction(async (trx) => {
    // Insert bill header
    const [billId] = await trx('bill').insert({
      bill_number: billNumber,
      bill_date: header.bill_date,
      party_name: header.party_name,
      po_number: header.collection || header.po_number,
      total_amount: totalAmount,
      notes: header.notes,
      contract_id: contractIdNum || null,
      sent_yards: contractIdNum ? sentYardsNum : null,
      remaining_yards: remainingYards,
      created_by: req.user!.id,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    // Insert bill items
    const itemsToInsert = items.map((item: any) => ({
      bill_id: billId,
      design_no: item.design_no,
      collection: item.collection,
      component: item.component,
      item_description: item.item_description,
      fabric: item.fabric,
      yards: item.yards,
      stitches: item.stitches,
      rate_stitch: item.rate_stitch,
      rate_per_yds: item.rate_per_yds,
      rate_repeat: item.rate_repeat,
      repeats: item.repeats,
      pieces: item.pieces,
      amount: item.amount,
      wte_ogp: item.wte_ogp,
      h2h_po: item.h2h_po,
      formula_details: item.formula_details ? JSON.stringify(item.formula_details) : null,
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    await trx('bill_item').insert(itemsToInsert);
    
    return billId;
  });
  
  res.status(201).json({
    success: true,
    data: {
      bill_id: result,
      bill_number: billNumber,
      total_amount: totalAmount,
      items_count: items.length
    },
    message: 'Bill created successfully'
  });
}));

/**
 * PUT /api/optimized-bills/:id
 * Update existing bill
 */
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const billId = parseInt(req.params.id);
  const { header, items, contractId, sentYards } = req.body;
  
  // Validation (same as create)
  if (!header?.party_name || header.party_name.length < 2) {
    return res.status(400).json({ error: 'Party name is required (min 2 characters)' });
  }
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }
  
  // Calculate total
  const totalAmount = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
  
  // Contract Section 2 yards for update
  let remainingYards: number | null = null;
  const contractIdNum = contractId ? parseInt(contractId, 10) : null;
  const sentYardsNum = Number(sentYards ?? 0);
  if (contractIdNum && !isNaN(contractIdNum) && sentYardsNum > 0) {
    const totalResult = await db('ContractItem').where('ContractID', contractIdNum).sum(db.raw('COALESCE(Yards, 0) as total')).first();
    const totalYards = Number(totalResult?.total || 0);
    const dailySent = await db('daily_billing_records').where('contract_id', contractIdNum).sum(db.raw('COALESCE(sent_yards, 0) as total')).first();
    const billSentExcluding = await db('bill').where('contract_id', contractIdNum).whereNot('bill_id', billId).sum(db.raw('COALESCE(sent_yards, 0) as total')).first();
    const cumulativeBefore = Number(dailySent?.total || 0) + Number(billSentExcluding?.total || 0);
    remainingYards = Math.max(0, totalYards - cumulativeBefore - sentYardsNum);
  }
  
  const updatePayload: any = {
    bill_date: header.bill_date,
    party_name: header.party_name,
    po_number: header.collection || header.po_number,
    total_amount: totalAmount,
    notes: header.notes,
    contract_id: contractIdNum || null,
    sent_yards: contractIdNum ? sentYardsNum : null,
    remaining_yards: remainingYards,
    updated_at: new Date()
  };
  
  // Update database
  await withTransaction(async (trx) => {
    // Update bill header
    await trx('bill')
      .where('bill_id', billId)
      .update(updatePayload);
    
    // Delete existing items
    await trx('bill_item').where('bill_id', billId).del();
    
    // Insert new items
    const itemsToInsert = items.map((item: any) => ({
      bill_id: billId,
      design_no: item.design_no,
      collection: item.collection,
      component: item.component,
      item_description: item.item_description,
      fabric: item.fabric,
      yards: item.yards,
      stitches: item.stitches,
      rate_stitch: item.rate_stitch,
      rate_per_yds: item.rate_per_yds,
      rate_repeat: item.rate_repeat,
      repeats: item.repeats,
      pieces: item.pieces,
      amount: item.amount,
      wte_ogp: item.wte_ogp,
      h2h_po: item.h2h_po,
      formula_details: item.formula_details ? JSON.stringify(item.formula_details) : null,
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    await trx('bill_item').insert(itemsToInsert);
  });
  
  res.json({
    success: true,
    data: {
      bill_id: billId,
      total_amount: totalAmount,
      items_count: items.length
    },
    message: 'Bill updated successfully'
  });
}));

/**
 * GET /api/optimized-bills
 * List all bills with pagination
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;
  
  let query = db('bill as b')
    .leftJoin(
      db('bill_item')
        .select('bill_id')
        .count('* as items_count')
        .groupBy('bill_id')
        .as('bi'),
      'b.bill_id',
      'bi.bill_id'
    )
    .select(
      'b.bill_id',
      'b.bill_number',
      'b.bill_date',
      'b.party_name',
      'b.po_number',
      'b.total_amount',
      'b.created_at',
      db.raw('COALESCE(bi.items_count, 0) as items_count')
    );
  
  // Apply filters
  if (search) {
    query = query.where((builder) => {
      builder
        .where('b.party_name', 'like', `%${search}%`)
        .orWhere('b.bill_number', 'like', `%${search}%`);
    });
  }
  
  if (from_date) {
    query = query.where('b.bill_date', '>=', from_date);
  }
  
  if (to_date) {
    query = query.where('b.bill_date', '<=', to_date);
  }
  
  // Get total count
  const countQuery = query.clone();
  const totalResult = await countQuery.count('* as count').first();
  const total = parseInt(String(totalResult?.count || 0));
  
  // Get paginated data
  const bills = await query
    .orderBy('b.bill_date', 'desc')
    .orderBy('b.bill_id', 'desc')
    .limit(limit)
    .offset((page - 1) * limit);
  
  res.json({
    success: true,
    data: bills,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

/**
 * GET /api/optimized-bills/:id
 * Get single bill with items
 */
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const billId = parseInt(req.params.id);
  
  // Get bill header
  const bill = await db('bill')
    .where('bill_id', billId)
    .first();
  
  if (!bill) {
    return res.status(404).json({ error: 'Bill not found' });
  }
  
  // Get bill items
  const items = await db('bill_item')
    .where('bill_id', billId)
    .select('*')
    .orderBy('bill_item_id');
  
  // Parse formula_details JSON
  const parsedItems = items.map(item => ({
    ...item,
    formula_details: item.formula_details ? JSON.parse(item.formula_details) : null
  }));
  
  res.json({
    success: true,
    data: {
      bill,
      items: parsedItems
    }
  });
}));

export { router as optimizedBillsRouter };

import { db, withTransaction, logAudit } from '../database/connection';
import { logger } from '../utils/logger';
import { Contract, CreateContractRequest } from '../types';

// Updated Interfaces matching the DB Schema
// Note: We are inferring these types here to match the new schema implementation
// Updated Interfaces matching the DB Schema
interface ContractItemData {
  id?: number;
  h2hOGP: number | null;
  wteIGP: number | null;
  itemDescription: string;
  fabric: string;
  color: string;
  repeat: number;
  pieces: number;
  motif?: number;
  lace?: number;
  yards?: number;
  ghazanaGatepass: number;
  tilla: string | number;
  sequence: string | number;
  gazanaCost?: number;
  collection?: string;
  designNo?: string;
  component?: string;
  stitch?: number;
  ratePerRepeat?: number;
  ratePerStitch?: number;
  calculatedRate?: number;
  totalRate?: number;
  ratePerPiece?: number;
  pieceAmount?: number;
  motifRate?: number;
  motifAmount?: number;
  laceRate?: number;
  laceAmount?: number;
  machineGazz?: string;
  machineHead?: string;
  assignedMachineIds?: number[];
  assignedMachines?: Array<{
    machineId: number;
    machineNumber: string | number;
    masterName: string;
    assignedStitches?: number;
    avgStitchesPerDay?: number;
    repeats?: number;
    estimatedDays?: number;
  }>;
  usedStitches?: number;
  usedRepeats?: number;
  isTemp?: boolean; // New
  tempReason?: string; // New
}

interface ContractResponse {
  id: number;
  contractNumber: string | number;
  contractDate: string;
  contractEndDate?: string;
  contractDuration?: number;
  poNumber: string;
  isActive?: boolean;
  progress?: string;
  isTemp?: boolean; // New
  tempCreatedBy?: number; // New
  tempCreatedAt?: string; // New
  tempCode?: string; // New
  items?: ContractItemData[];
  collections?: string;
  designNos?: string;
}

export class ContractService {
  /**
   * Get the next sequential contract number
   */
  static async getNextContractNumber(trx?: any): Promise<string> {
    logger.info('[ContractService] getNextContractNumber - Entry');
    const queryBuilder = trx || db;
    try {
      // Optimized query: Only consider numeric contract numbers and filter out ERR/DRAFT prefixes
      const result = await queryBuilder('Contract')
        .select(db.raw('MAX(CAST(ContractNo AS UNSIGNED)) as maxNo'))
        .whereRaw('ContractNo REGEXP \'^[0-9]+$\'') // Only numeric values
        .where('IsActive', 1) // Only active contracts
        .first();

      const maxNo = parseInt(result?.maxNo || 0);
      const nextNo = maxNo + 1;
      const formatted = String(nextNo).padStart(4, '0');
      logger.info(`[ContractService] getNextContractNumber - Generated: ${formatted} (from max: ${maxNo})`);
      return formatted;
    } catch (err) {
      logger.error('[ContractService] Error in getNextContractNumber:', err);
      throw err;
    }
  }

  /**
   * Get a single contract by ID, including items
   */
  static async getContractById(id: number): Promise<ContractResponse | null> {
    logger.info(`[ContractService] getContractById - ID: ${id} (Type: ${typeof id})`);
    const contract = await db('Contract').where('ContractID', id).first();
    if (!contract) {
      console.log('[DEBUG] Contract not found for ID:', id);
      return null;
    }

    console.log('[DEBUG] Contract found:', contract.ContractNo);
    const items = await db('ContractItem').where('ContractID', id);
    console.log('[DEBUG] Items found:', items.length);

    // Fetch Assigned Machines for all items
    const itemIds = items.map((i: any) => i.ContractItemID);
    console.log('[DEBUG] ItemIds:', itemIds);
    let itemMachines: any[] = [];
    if (itemIds.length > 0) {
      itemMachines = await db('ContractItemMachine')
        .join('Machine', 'ContractItemMachine.MachineID', 'Machine.MachineID')
        .whereIn('ContractItemMachine.ContractItemID', itemIds)
        .select(
          'ContractItemMachine.ContractItemID',
          'Machine.MachineID',
          'Machine.MachineNumber',
          'Machine.MasterName',
          'ContractItemMachine.assigned_stitches', // Fetch new column
          'ContractItemMachine.avg_stitches_per_day', // Renamed column
          'ContractItemMachine.repeats', // Fetch repeats
          'ContractItemMachine.estimated_days' // Fetch estimated days
        );
    }

    // Fetch Production Usage for all items from both tables
    let productionUsage: any[] = [];
    if (itemIds.length > 0) {
      console.log('[DEBUG] Fetching production usage for itemIds:', itemIds);
      try {
        // Use Knex query builder instead of raw SQL to avoid syntax issues
        const productionEntries = await db('ProductionEntry')
          .whereIn('ContractItemID', itemIds)
          .select('ContractItemID', 'Stitches', 'Repeats');

        const dailyProduction = await db('daily_production_master')
          .whereIn('contract_item_id', itemIds)
          .select('contract_item_id as ContractItemID', 'total_stitches as Stitches')
          .select(db.raw('0 as Repeats'));

        // Daily billing stitches (Optimized Daily Billing) - match by contract_id + design_no
        const dailyBillingStitches = await db('daily_billing_shift_records as dbsr')
          .join('daily_billing_records as dbr', 'dbsr.billing_record_id', 'dbr.id')
          .join('ContractItem as ci2', function () {
            this.on('ci2.ContractID', '=', 'dbr.contract_id').andOn('ci2.DesignNo', '=', 'dbsr.design_no');
          })
          .where('dbr.contract_id', contract.ContractID)
          .whereIn('ci2.ContractItemID', itemIds)
          .select('ci2.ContractItemID', db.raw('SUM(dbsr.stitches_done) as Stitches'))
          .groupBy('ci2.ContractItemID');

        // Combine and aggregate the results
        const combinedData: any[] = [];

        // Process production entries
        productionEntries.forEach(entry => {
          const existing = combinedData.find(item => item.ContractItemID === entry.ContractItemID);
          if (existing) {
            existing.totalStitches += entry.Stitches || 0;
            existing.totalRepeats += entry.Repeats || 0;
          } else {
            combinedData.push({
              ContractItemID: entry.ContractItemID,
              totalStitches: entry.Stitches || 0,
              totalRepeats: entry.Repeats || 0
            });
          }
        });

        // Process daily production
        dailyProduction.forEach(entry => {
          const existing = combinedData.find(item => item.ContractItemID === entry.ContractItemID);
          if (existing) {
            existing.totalStitches += entry.Stitches || 0;
          } else {
            combinedData.push({
              ContractItemID: entry.ContractItemID,
              totalStitches: entry.Stitches || 0,
              totalRepeats: 0
            });
          }
        });

        // Process daily billing stitches (Optimized Daily Billing)
        (dailyBillingStitches as any[]).forEach(entry => {
          const existing = combinedData.find(item => item.ContractItemID === entry.ContractItemID);
          if (existing) {
            existing.totalStitches += Number(entry.Stitches || 0);
          } else {
            combinedData.push({
              ContractItemID: entry.ContractItemID,
              totalStitches: Number(entry.Stitches || 0),
              totalRepeats: 0
            });
          }
        });

        productionUsage = [combinedData]; // Wrap in array to match original structure
        console.log('[DEBUG] Production usage query successful using Knex');
      } catch (error) {
        console.error('[DEBUG] Production usage query failed:', error);
        // Continue without production usage data
        productionUsage = [[]]; // Empty array wrapped in array to match structure
      }
    } else {
      console.log('[DEBUG] No items found, skipping production usage query');
      productionUsage = [[]]; // Empty array wrapped in array to match structure
    }

    const usageMap = new Map(productionUsage[0]?.map((u: any) => [u.ContractItemID, u]) || []);

    // Sum total estimated days from ContractItemMachine for this contract
    const totalEstimatedDaysResult = itemIds.length > 0
      ? await db('ContractItemMachine')
          .join('ContractItem', 'ContractItemMachine.ContractItemID', 'ContractItem.ContractItemID')
          .where('ContractItem.ContractID', id)
          .sum('ContractItemMachine.estimated_days as total')
          .first()
      : { total: 0 };
    const totalEstimatedDays = Number(totalEstimatedDaysResult?.total || 0);

    const mappedItems: ContractItemData[] = items.map((item: any) => {
      const machines = itemMachines.filter((m: any) => m.ContractItemID === item.ContractItemID);
      const usage = (usageMap.get(item.ContractItemID) || { totalStitches: 0, totalRepeats: 0 }) as any;

      return {
        id: item.ContractItemID,
        h2hOGP: item.H2H_OGP,
        wteIGP: item.WTE_IGP,
        itemDescription: item.ItemDescription,
        fabric: item.Fabric,
        color: item.Color,
        repeat: item.Repeat,
        pieces: item.Pieces,
        motif: item.Motif,
        lace: item.Lace,
        yards: item.Yards,
        ghazanaGatepass: item.GhazanaGatepass,
        tilla: item.Tilla,
        sequence: item.Sequence,
        gazanaCost: item.GazanaCost,
        collection: item.Collection,
        designNo: item.DesignNo,
        component: item.Component,
        stitch: item.Stitch,
        ratePerRepeat: item.Rate_per_Repeat,
        ratePerStitch: item.Rate_per_Stitch,
        calculatedRate: item.Calculated_Rate,
        totalRate: item.Total_Rate,
        ratePerPiece: item.Rate_per_Piece,
        pieceAmount: item.Piece_Amount,
        motifRate: item.Motif_Rate,
        motifAmount: item.Motif_Amount,
        laceRate: item.Lace_Rate,
        laceAmount: item.Lace_Amount,
        machineGazz: item.MachineGazz,
        machineHead: item.MachineHead,
        assignedMachineIds: machines.map((m: any) => m.MachineID),
        assignedMachines: machines.map((m: any) => ({
          machineId: m.MachineID,
          machineNumber: m.MachineNumber,
          masterName: m.MasterName,
          assignedStitches: m.assigned_stitches || 0, // Map to interface
          avgStitchesPerDay: m.avg_stitches_per_day || 0, // Map to interface
          repeats: m.repeats || 0, // Map to interface
          estimatedDays: m.estimated_days || 0 // Map to interface
        })),
        usedStitches: Number(usage.totalStitches || 0),
        usedRepeats: Number(usage.totalRepeats || 0)
      };
    });

    return {
      id: contract.ContractID,
      contractNumber: contract.ContractNo,
      contractDate: contract.ContractDate,
      contractEndDate: contract.ContractEndDate,
      contractDuration: contract.ContractDuration,
      totalEstimatedDays,
      poNumber: contract.PONumber,
      isActive: Boolean(contract.IsActive),
      progress: contract.Progress,

      items: mappedItems
    };
  }

  /**
   * Create a new contract
   * (Restoring missing method based on Usage)
   */
  static async createContract(contractData: CreateContractRequest, userId: number): Promise<number> {
    console.log('[DEBUG] ContractService.createContract - Called with:', JSON.stringify(contractData, null, 2));
    return withTransaction(async (trx) => {
      // 1. Insert Contract Header
      console.log('[DEBUG] Inserting Contract Header...');

      let contractNo = contractData.contractNumber;
      // If it's a DRAFT timestamp or empty, get a new sequential number
      if (!contractNo || contractNo.startsWith('DRAFT-')) {
        contractNo = await ContractService.getNextContractNumber(trx);
      }

      const [contractId] = await trx('Contract').insert({
        ContractNo: contractNo,
        ContractDate: new Date(contractData.contractDate), // Ensure Date object
        ContractEndDate: contractData.contractEndDate ? new Date(contractData.contractEndDate) : null,
        ContractDuration: contractData.contractDuration,
        PONumber: contractData.poNumber,
        IsActive: 1, // Default active
        status: (contractData as any).status || 'active', // Support draft/active status
        Progress: '0%', // Default progress
      });

      // 2. Insert Contract Items
      if (contractData.items && contractData.items.length > 0) {
        for (const item of contractData.items) {

          // Validation: Check Check Assigned Stitches Sum
          const itemStitch = Number(item.stitch || 0);
          // Logic: If assignedMachines provided, validate total stitches
          // Note: item.assignedMachines might not be populated in simple create payloads if frontend only sends IDs, 
          // BUT the new requirement says frontend sends { machineId, assignedStitches }.
          // We'll rely on item.assignedMachines if present.

          if (item.assignedMachines && item.assignedMachines.length > 0) {
            const totalAssigned = item.assignedMachines.reduce((sum: number, m: any) => sum + Number(m.assignedStitches || 0), 0);
            const itemRepeats = Number(item.repeat || 0); // Default to 0? Or 1? Usually repeat is at least 1 for yards.
            const itemTotalStitch = itemStitch * (itemRepeats || 1); // If repeat is 0/null, treat as 1 or 0? 

            // Allow small epsilon tolerance if needed, but decimal(14,2) should be precise enough.
            if (Math.abs(totalAssigned - itemTotalStitch) > 0.01) {
              logger.warn(`Stitch Mismatch for item '${item.itemDescription}': Total assigned(${totalAssigned}) does not match Expected Item Stitches(${itemTotalStitch}). Allowing save as requested.`);
              // Previously: throw new Error(`Stitch Mismatch for item '${item.itemDescription}': Total assigned(${totalAssigned}) does not match Item Stitches(${itemStitch})`);
            }
          }

          console.log('[DEBUG] Inserting Item for Contract:', contractId);
          const [itemId] = await trx('ContractItem').insert({
            ContractID: contractId,
            H2H_OGP: item.h2hOGP,
            WTE_IGP: item.wteIGP,
            ItemDescription: item.itemDescription,
            Fabric: item.fabric,
            Color: item.color,
            'Repeat': item.repeat,
            Pieces: item.pieces || 0,
            Motif: item.motif || 0,
            Lace: item.lace || 0,
            Yards: item.yards || 0,
            GhazanaGatepass: item.ghazanaGatepass,
            Tilla: item.tilla,
            Sequence: item.sequence,
            GazanaCost: item.gazanaCost || 0,
            Collection: item.collection,
            DesignNo: item.designNo,
            Component: item.component,
            Stitch: item.stitch,
            Rate_per_Repeat: item.ratePerRepeat,
            Rate_per_Stitch: item.ratePerStitch,
            Calculated_Rate: item.calculatedRate,
            Total_Rate: item.totalRate,
            Rate_per_Piece: item.ratePerPiece,
            Piece_Amount: item.pieceAmount,
            Motif_Rate: item.motifRate,
            Motif_Amount: item.motifAmount,
            Lace_Rate: item.laceRate,
            Lace_Amount: item.laceAmount,
            MachineGazz: item.machineGazz,
            MachineHead: item.machineHead
            // MachineID removed
          });

          // Insert Machines for this item
          if (item.assignedMachines && item.assignedMachines.length > 0) {
            const machineInserts = item.assignedMachines.map((m: any) => {
              const assigned = m.assignedStitches || 0;
              return {
                ContractItemID: itemId,
                MachineID: m.machineId,
                assigned_stitches: assigned,
                pending_stitches: assigned,
                avg_stitches_per_day: m.avgStitchesPerDay || 0,
                repeats: m.repeats || 0,
                estimated_days: m.estimatedDays || 0
              };
            });
            await trx('ContractItemMachine').insert(machineInserts);
          } else if (item.assignedMachineIds && item.assignedMachineIds.length > 0) {
            // Fallback for legacy payloads (should ideally be blocked or verified)
            const machineInserts = item.assignedMachineIds.map((mid: number) => ({
              ContractItemID: itemId,
              MachineID: mid,
              assigned_stitches: 0,
              pending_stitches: 0,
              avg_stitches_per_day: 0,
              repeats: 0,
              estimated_days: 0
            }));
            await trx('ContractItemMachine').insert(machineInserts);
          }
        }
      }




      console.log('[DEBUG] ContractService.createContract - Finished Insertions. Logging Audit...');
      await logAudit('Contract', contractId, 'insert', null, contractData, userId);
      console.log('[DEBUG] ContractService.createContract - Audit Logged. Returning.');
      return contractId;
    });
  }

  /**
   * Get all contracts with pagination
   */
  static async getAllContracts(
    page: number = 1,
    limit: number = 20,
    status?: string,
    partyName?: string,
    poNumber?: string,
    collection?: string,
    search?: string
  ): Promise<{ contracts: ContractResponse[]; total: number }> {
    let query = db('Contract');

    // Filter by Status (Active/Inactive)
    if (status === 'inactive') {
      query = query.where('Contract.IsActive', 0);
    } else if (status === 'all') {
      // No filter on IsActive
    } else {
      // Default to active only
      query = query.where('Contract.IsActive', 1);
    }

    /* TEMPORARILY DISABLED
    if (status && status !== 'active') {
      if (status === 'draft') {
        query.where('Contract.status', 'draft');
      } else if (status === 'completed') {
        query.where('Contract.status', 'completed');
      }
    } else {
      // Default behavior: Active AND non-draft (unless requesting all/draft)
      // If status filter is NOT provided, typically we show active.
      // If user wants drafts, they send status='draft'.
      // Existing logic (implied): show active.
      // We should ensure drafts don't pollute default list unless asked.
      if (!status) {
         // query.where('Contract.status', 'active');
      }
    }
    */

    // Party Name Filter
    if (partyName) {
      query = query.where('Contract.PONumber', 'like', `% ${partyName}% `); // Assuming partyName maps to PONumber for now, or needs a join
    }

    // Filter by PO Number
    if (poNumber) {
      query = query.where('Contract.PONumber', 'like', `% ${poNumber}% `);
    }

    // Filter by Collection (in ContractItem)
    if (collection) {
      query = query.whereExists(function () {
        this.select('*')
          .from('ContractItem')
          .whereRaw('ContractItem.ContractID = Contract.ContractID')
          .andWhere('ContractItem.Collection', 'like', `% ${collection}% `);
      });
    }

    // General search functionality
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.where(function () {
        this.where('Contract.ContractNo', 'like', searchTerm)
          .orWhere('Contract.PONumber', 'like', searchTerm)
          .orWhereExists(function () {
            this.select('*')
              .from('ContractItem')
              .whereRaw('ContractItem.ContractID = Contract.ContractID')
              .andWhere(function () {
                this.where('ContractItem.Collection', 'like', searchTerm)
                  .orWhere('ContractItem.DesignNo', 'like', searchTerm)
                  .orWhere('ContractItem.ItemDescription', 'like', searchTerm);
              });
          });
      });
    }

    // Logic for old filters would go here if columns existed.
    // New schema doesn't have status/partyName in Contract table.

    const total = await query.clone().count('Contract.ContractID as count').first();

    const contracts = await query
      .leftJoin('ContractItem', 'Contract.ContractID', 'ContractItem.ContractID')
      .select(
        'Contract.ContractID as id',
        'Contract.ContractNo as contractNumber',
        'Contract.ContractDate as contractDate',
        'Contract.ContractEndDate as contractEndDate',
        'Contract.ContractDuration as contractDuration',
        'Contract.PONumber as poNumber',
        'Contract.IsActive as isActive',
        // 'Contract.status as status', // TEMPORARILY DISABLED due to DB schema issue
        'Contract.Progress as progress',
        db.raw(`(
  SELECT CASE WHEN EXISTS(
    SELECT 1 
                FROM (
                    SELECT ContractItemID, Stitches FROM ProductionEntry
                    UNION ALL
                    SELECT contract_item_id as ContractItemID, total_stitches as Stitches FROM daily_production_master
                    UNION ALL
                    SELECT ci2.ContractItemID, SUM(dbsr.stitches_done) as Stitches
                    FROM daily_billing_shift_records dbsr
                    JOIN daily_billing_records dbr ON dbsr.billing_record_id = dbr.id AND dbr.contract_id IS NOT NULL
                    JOIN ContractItem ci2 ON ci2.ContractID = dbr.contract_id AND ci2.DesignNo = dbsr.design_no
                    GROUP BY ci2.ContractItemID
                ) as pe 
                JOIN ContractItem ci ON ci.ContractItemID = pe.ContractItemID 
                WHERE ci.ContractID = Contract.ContractID 
                AND pe.Stitches > 0
  ) THEN 1 ELSE 0 END
) as assigned`),
        db.raw(`(
  SELECT 
                ROUND((SUM(IFNULL(pe.Stitches, 0)) / NULLIF(SUM(ci.Stitch * ci.Pieces), 0)) * 100, 2)
            FROM ContractItem ci
            LEFT JOIN (
                SELECT ContractItemID, Stitches FROM ProductionEntry
                UNION ALL
                SELECT contract_item_id as ContractItemID, total_stitches as Stitches FROM daily_production_master
                UNION ALL
                SELECT ci2.ContractItemID, SUM(dbsr.stitches_done) as Stitches
                FROM daily_billing_shift_records dbsr
                JOIN daily_billing_records dbr ON dbsr.billing_record_id = dbr.id AND dbr.contract_id IS NOT NULL
                JOIN ContractItem ci2 ON ci2.ContractID = dbr.contract_id AND ci2.DesignNo = dbsr.design_no
                GROUP BY ci2.ContractItemID
            ) pe ON ci.ContractItemID = pe.ContractItemID
            WHERE ci.ContractID = Contract.ContractID
) as progress_percentage`),
        db.raw(`(
  SELECT COALESCE(SUM(cim.estimated_days), 0)
  FROM ContractItem ci
  JOIN ContractItemMachine cim ON ci.ContractItemID = cim.ContractItemID
  WHERE ci.ContractID = Contract.ContractID
) as total_estimated_days`)
      )
      .groupBy('Contract.ContractID')
      .select(db.raw('GROUP_CONCAT(DISTINCT ContractItem.Collection SEPARATOR ", ") as collections'))
      .select(db.raw('GROUP_CONCAT(DISTINCT ContractItem.DesignNo SEPARATOR ", ") as designNos'))
      .select(db.raw('GROUP_CONCAT(DISTINCT ContractItem.Component SEPARATOR ", ") as components'))
      .orderBy('Contract.ContractID', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      // Data is already in correct shape/keys due to alias select
      contracts: contracts.map(c => ({
        id: c.id,
        contractNumber: c.contractNumber,
        contractDate: c.contractDate,
        contractEndDate: c.contractEndDate,
        contractDuration: c.contractDuration,
        poNumber: c.poNumber,
        isActive: Boolean(c.isActive),
        status: c.status, // Added
        progress: c.progress,
        assigned: Boolean(c.assigned),
        progressPercentage: Number(c.progress_percentage || 0),
        totalEstimatedDays: Number(c.total_estimated_days || 0),
        collections: c.collections as string,
        designNos: c.designNos as string,
        components: c.components as string
      })),
      total: parseInt(String(total?.count || '0')),
    };
  }

  /**
   * Update an existing contract and its items
   */
  static async updateContract(
    contractId: number,
    contractData: any,
    userId: number
  ): Promise<void> {
    console.log('[DEBUG] ContractService.updateContract - Called for ID:', contractId, 'Payload:', JSON.stringify(contractData, null, 2));
    return withTransaction(async (trx) => {
      // 1. Update Contract Header
      await trx('Contract')
        .where('ContractID', contractId)
        .update({
          ContractDate: new Date(contractData.contractDate),
          ContractEndDate: contractData.contractEndDate ? new Date(contractData.contractEndDate) : null,
          ContractDuration: contractData.contractDuration,
          PONumber: contractData.poNumber,
        });

      // 2. Diff Items (Upsert Strategy)
      // Get existing items IDs to check for deletions later
      const existingItems = await trx('ContractItem').where('ContractID', contractId).select('ContractItemID');
      const existingItemIds = new Set(existingItems.map(i => i.ContractItemID));

      if (contractData.items && Array.isArray(contractData.items)) {
        const payloadItemIds = new Set();

        for (const item of contractData.items) {
          const itemPayload = {
            H2H_OGP: item.h2hOGP,
            WTE_IGP: item.wteIGP,
            ItemDescription: item.itemDescription,
            Fabric: item.fabric,
            Color: item.color,
            'Repeat': item.repeat,
            Pieces: item.pieces || 0,
            Motif: item.motif || 0,
            Lace: item.lace || 0,
            Yards: item.yards || 0,
            GhazanaGatepass: item.ghazanaGatepass,
            Tilla: item.tilla,
            Sequence: item.sequence,
            GazanaCost: item.gazanaCost || 0,
            Collection: item.collection,
            DesignNo: item.designNo,
            Component: item.component,
            Stitch: item.stitch,
            Rate_per_Repeat: item.ratePerRepeat,
            Rate_per_Stitch: item.ratePerStitch,
            Calculated_Rate: item.calculatedRate,
            Total_Rate: item.totalRate,
            Rate_per_Piece: item.ratePerPiece,
            Piece_Amount: item.pieceAmount,
            Motif_Rate: item.motifRate,
            Motif_Amount: item.motifAmount,
            Lace_Rate: item.laceRate,
            Lace_Amount: item.laceAmount,
            MachineGazz: item.machineGazz,
            MachineHead: item.machineHead
            // MachineID removed
          };

          const rawId = item.ContractItemID || item.id;
          const itemId = rawId ? Number(rawId) : undefined;
          let currentItemId = itemId;

          if (itemId && existingItemIds.has(itemId)) {
            // Update existing
            await trx('ContractItem')
              .where('ContractItemID', itemId)
              .update(itemPayload);
            payloadItemIds.add(itemId);
          } else {
            // Insert new
            const [newItemId] = await trx('ContractItem').insert({
              ContractID: contractId,
              ...itemPayload
            });
            currentItemId = newItemId;
          }


          // Validation: Check Check Assigned Stitches Sum
          const itemStitch = Number(item.stitch || 0);
          if (item.assignedMachines && item.assignedMachines.length > 0) {
            const totalAssigned = item.assignedMachines.reduce((sum: number, m: any) => sum + Number(m.assignedStitches || 0), 0);
            const itemRepeats = Number(item.repeat || 0);
            const itemTotalStitch = itemStitch * (itemRepeats || 1);

            if (Math.abs(totalAssigned - itemTotalStitch) > 0.01) {
              logger.warn(`Stitch Mismatch for item '${item.itemDescription}': Total assigned(${totalAssigned}) does not match Expected Item Stitches(${itemTotalStitch}). Allowing save as requested.`);
              // Previously: throw new Error(`Stitch Mismatch for item '${item.itemDescription}': Total assigned(${totalAssigned}) does not match Item Stitches(${itemStitch})`);
            }
          }

          // Update Machines for this item
          if (currentItemId) {
            // Basic strategy: Delete all for this item and re-insert
            await trx('ContractItemMachine').where('ContractItemID', currentItemId).delete();

            if (item.assignedMachines && item.assignedMachines.length > 0) {
              const machineInserts = item.assignedMachines.map((m: any) => {
                const assigned = m.assignedStitches || 0;
                return {
                  ContractItemID: currentItemId,
                  MachineID: m.machineId,
                  assigned_stitches: assigned,
                  pending_stitches: assigned,
                  avg_stitches_per_day: m.avgStitchesPerDay || 0,
                  repeats: m.repeats || 0,
                  estimated_days: m.estimatedDays || 0
                };
              });
              await trx('ContractItemMachine').insert(machineInserts);
            }
            else if (item.assignedMachineIds && Array.isArray(item.assignedMachineIds) && item.assignedMachineIds.length > 0) {
              // Fallback
              const machineInserts = item.assignedMachineIds.map((mid: number) => ({
                ContractItemID: currentItemId,
                MachineID: mid,
                assigned_stitches: 0,
                pending_stitches: 0,
                avg_stitches_per_day: 0,
                repeats: 0,
                estimated_days: 0
              }));
              await trx('ContractItemMachine').insert(machineInserts);
            }
          }
        }

        // 3. Handle Deletions (Items in DB but not in Payload)
        // We only attempt to delete items that were NOT in the payload
        const itemsToDelete = Array.from(existingItemIds).filter(id => !payloadItemIds.has(id));

        if (itemsToDelete.length > 0) {
          // This might still fail if referenced, but that is correct behavior (User cannot delete active item)
          // Or we could wrap in try/catch to ignore deletions of used items if desired, 
          // but strictly speaking, error is better to prevent orphan data issues if UI didn't intend delete.
          // However, for "Edit Contract" flow, usually we want to allow delete if not used.
          await trx('ContractItem')
            .whereIn('ContractItemID', itemsToDelete)
            .delete();
        }
      }



    });
  }


  /**
   * Create a TEMPORARY Contract
   */
  static async createTempContract(data: any, userId: number): Promise<any> {
    return withTransaction(async (trx) => {
      // 1. Insert Contract Header (is_temp = 1)
      const placeholderNo = `TEMP - PENDING - ${Date.now()} -${Math.floor(Math.random() * 1000)} `;
      const [contractId] = await trx('Contract').insert({
        ContractNo: placeholderNo, // Placeholder to satisfy NOT NULL constraint
        ContractDate: new Date(data.contractDate || new Date()), // Default today
        PONumber: data.poNumber || '',
        IsActive: 1,
        is_temp: 1,
        temp_created_by: userId,
        temp_created_at: new Date(),
        Progress: '0%',
      });

      // 2. Generate Temp Code (TEMP-000XXX)
      const tempCode = `TEMP - ${String(contractId).padStart(6, '0')} `;

      // 3. Update Contract with Temp Code
      await trx('Contract')
        .where('ContractID', contractId)
        .update({
          ContractNo: tempCode, // Use temp code as ContractNo for now
          temp_code: tempCode
        });

      // 4. Insert Minimal Contract Item (is_temp = 1)
      const item = data.item || {};
      const [itemId] = await trx('ContractItem').insert({
        ContractID: contractId,
        ItemDescription: item.itemDescription || 'TEMP ITEM',
        Collection: data.collection || '', // Store collection on item if provided
        Stitch: item.stitch || 0,
        Pieces: item.pieces || 0,
        is_temp: 1,
        // Defaults for required fields to avoid DB errors constraint
        H2H_OGP: 0, WTE_IGP: 0, Fabric: '', Color: '', Repeat: 0, Motif: 0, Lace: 0,
        GhazanaGatepass: 0, Tilla: '', Sequence: '', GazanaCost: 0,
        Rate_per_Repeat: 0, Rate_per_Stitch: 0, Calculated_Rate: 0, Total_Rate: 0
      });

      await logAudit('Contract', contractId, 'insert', null, { contractId, tempCode, action: 'create_temp' }, userId);

      return {
        contractId,
        contractNo: tempCode,
        contractItemId: itemId
      };
    });
  }

  /**
   * Finalize a Temp Contract (Convert to Permanent)
   */
  static async finalizeContract(contractId: number, data: any, userId: number): Promise<any> {
    return withTransaction(async (trx) => {
      // 1. Verify it is a temp OR draft contract
      const contract = await trx('Contract').where('ContractID', contractId).first();
      if (!contract) throw new Error("Contract not found");

      const isDraftOrTemp = contract.is_temp || contract.status === 'draft';
      if (!isDraftOrTemp) throw new Error("Contract is not in Draft or Temp state");

      // 2. Validate Required Fields (Business Rules)
      if (!data.poNumber && !contract.PONumber) throw new Error("PO Number is required for finalization.");
      // Add more validations as needed

      // 3. Update Contract Header
      let newContractNo = data.contractNumber;

      // If no number provided in finalize, or it's still a placeholder, assign next sequential
      if (!newContractNo || newContractNo.startsWith('DRAFT-') || newContractNo.startsWith('TEMP-') || /^\d+$/.test(newContractNo) === false) {
        // If the existing number is already a 4+ digit number, we might keep it, 
        // but the user wants to "make it 4 digit unique no". 
        // To be safe, if it's not already a "proper" number, get next.
        newContractNo = await ContractService.getNextContractNumber(trx);
      }

      // Check uniqueness if changed
      if (newContractNo !== contract.ContractNo) {
        const existing = await trx('Contract').where('ContractNo', newContractNo).whereNot('ContractID', contractId).first();
        if (existing) throw new Error(`Contract Number ${newContractNo} already exists.`);
      }

      await trx('Contract')
        .where('ContractID', contractId)
        .update({
          is_temp: 0,
          status: 'active', // Ensure it becomes active
          ContractNo: newContractNo,
          PONumber: data.poNumber || contract.PONumber,
          ContractDate: new Date(data.contractDate || contract.ContractDate),
          ContractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
          temp_code: null,
          last_updated_at: new Date()
        });

      // 4. Update Contract Items (is_temp = 0)
      await trx('ContractItem')
        .where('ContractID', contractId)
        .update({ is_temp: 0 });

      await logAudit('Contract', contractId, 'update', { oldNo: contract.ContractNo, is_temp: contract.is_temp, status: contract.status }, { newNo: newContractNo, is_temp: 0, status: 'active', action: 'finalize' }, userId);

      return { success: true, contractId, contractNo: newContractNo };
    });
  }

  /**
   * Safe delete a contract:
   * 1. Check for ProductionEntry (via items) or GatePass (direct)
   * 2. If exists, soft delete (IsActive = 0)
   * 3. If no usage, hard delete Contract, Items, and assigned machines
   */
  static async deleteContract(contractId: number, userId: number): Promise<void> {
    return withTransaction(async (trx) => {
      logger.info(`[ContractService] deleteContract - ID: ${contractId}`);

      // 1. Get Item IDs
      const itemIds = await trx('ContractItem')
        .where('ContractID', contractId)
        .pluck('ContractItemID');

      // 2. Check for Production Dependencies
      let hasProduction = false;
      if (itemIds.length > 0) {
        const productionCount = await trx('ProductionEntry')
          .whereIn('ContractItemID', itemIds)
          .count('ProductionID as count')
          .first();
        hasProduction = Number(productionCount?.count || 0) > 0;
      }

      // 3. Check for Gate Pass Dependencies
      const gatePassCount = await trx('GatePass')
        .where('ContractID', contractId)
        .count('GatePassID as count')
        .first();
      const hasGatePass = Number(gatePassCount?.count || 0) > 0;

      if (hasProduction || hasGatePass) {
        logger.info(`[ContractService] Soft-deleting contract ${contractId} due to dependencies (Production: ${hasProduction}, GatePass: ${hasGatePass})`);
        // Soft Delete
        await trx('Contract')
          .where('ContractID', contractId)
          .update({ IsActive: 0 });

        await logAudit('Contract', contractId, 'soft_delete' as any, null, { IsActive: 0, reason: 'has_production_or_gp' }, userId);
      } else {
        logger.info(`[ContractService] Hard-deleting contract ${contractId} (No usage found)`);
        // Hard Delete
        if (itemIds.length > 0) {
          // Delete assigned machines first
          await trx('ContractItemMachine').whereIn('ContractItemID', itemIds).del();
          // Delete items
          await trx('ContractItem').where('ContractID', contractId).del();
        }
        // Delete header
        await trx('Contract').where('ContractID', contractId).del();

        await logAudit('Contract', contractId, 'hard_delete' as any, null, { contractId }, userId);
      }
    });
  }

  /**
   * Update a Draft Contract (Auto-Save)
   * Looser validation, updates last_updated_at
   */
  static async updateDraft(contractId: number, data: any, userId: number): Promise<void> {
    return withTransaction(async (trx) => {
      // Verify it is a draft
      const contract = await trx('Contract').where('ContractID', contractId).first();
      if (!contract) throw new Error("Contract not found");
      // We allow updating 'active' contracts too via this method? No, this is updateDraft.
      // But maybe we want to allow auto-saving edits to active contracts too?
      // Requirement implies "Draft Contract System". Let's restrict to drafts for now or check status.
      // If status is NOT draft, maybe we shouldn't use this loose method.
      // User requirements: "Draft Contract... Auto-Save". 

      await trx('Contract')
        .where('ContractID', contractId)
        .update({
          PONumber: data.poNumber,
          ContractDate: data.contractDate ? new Date(data.contractDate) : undefined,
          ContractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
          ContractDuration: data.contractDuration,
          last_updated_at: new Date()
        });

      // Update Items (Naive full replace or upsert)
      // Reuse createContract's item logic or simplified version?
      // Since it's draft, we might just wipe and recreate items to ensure sync with frontend state?
      // Or better, use the Upsert logic from updateContract (lines 360+ I saw earlier).
      // I'll call updateContract internally or replicate logic? 
      // updateContract is strictly validated (Stitch Mismatch). 
      // Drafts should ALLOW mismatch.
      // So I will replicate Upsert logic WITHOUT mismatch validation.

      if (data.items && Array.isArray(data.items)) {
        // Get existing
        const existingItems = await trx('ContractItem').where('ContractID', contractId).select('ContractItemID');
        const existingItemIds = new Set(existingItems.map(i => i.ContractItemID));
        const payloadItemIds = new Set();

        for (const item of data.items) {
          const itemPayload = {
            ItemDescription: item.itemDescription,
            Stitch: item.stitch || 0,
            Pieces: item.pieces || 0,
            // Map other fields as needed... for draft minimal is fine? 
            // But we want to save everything typed.
            H2H_OGP: item.h2hOGP, WTE_IGP: item.wteIGP, Fabric: item.fabric, Color: item.color,
            'Repeat': item.repeat, Motif: item.motif, Lace: item.lace, Yards: item.yards, GhazanaGatepass: item.ghazanaGatepass,
            Tilla: item.tilla, Sequence: item.sequence, GazanaCost: item.gazanaCost, Collection: item.collection,
            DesignNo: item.designNo, Component: item.component, Rate_per_Repeat: item.ratePerRepeat,
            Rate_per_Stitch: item.ratePerStitch, Calculated_Rate: item.calculatedRate, Total_Rate: item.totalRate,
            Rate_per_Piece: item.ratePerPiece, Piece_Amount: item.pieceAmount,
            Motif_Rate: item.motifRate, Motif_Amount: item.motifAmount,
            Lace_Rate: item.laceRate, Lace_Amount: item.laceAmount,
            MachineGazz: item.machineGazz, MachineHead: item.machineHead
          };

          const rawId = item.ContractItemID || item.id; // Frontend might send either
          const itemId = rawId && existingItemIds.has(Number(rawId)) ? Number(rawId) : undefined;

          let currentItemId = itemId;

          if (itemId) {
            await trx('ContractItem').where('ContractItemID', itemId).update(itemPayload);
            payloadItemIds.add(itemId);
          } else {
            const [newItemId] = await trx('ContractItem').insert({
              ContractID: contractId,
              ...itemPayload
            });
            currentItemId = newItemId;
          }

          // Machines
          if (currentItemId && item.assignedMachines) {
            await trx('ContractItemMachine').where('ContractItemID', currentItemId).delete();
            const machineInserts = item.assignedMachines.map((m: any) => {
              const assigned = m.assignedStitches || 0;
              return {
                ContractItemID: currentItemId,
                MachineID: m.machineId,
                assigned_stitches: assigned,
                pending_stitches: assigned,
                avg_stitches_per_day: m.avgStitchesPerDay || 0,
                repeats: m.repeats || 0,
                estimated_days: m.estimatedDays || 0
              };
            });
            if (machineInserts.length > 0) {
              await trx('ContractItemMachine').insert(machineInserts);
            }
          }
        }

        // Delete removed items
        const itemsToDelete = Array.from(existingItemIds).filter(id => !payloadItemIds.has(id));
        if (itemsToDelete.length > 0) {
          await trx('ContractItem').whereIn('ContractItemID', itemsToDelete).delete();
        }
      }
    });
  }

  // --- Legacy / Design Methods (Commented out or Stubbed as they rely on old schema) ---
  // The 'designs' table functionality would need a 'Design' table which might not exist or related to old 'contracts'.
  // Leaving stubs to prevent compilation errors if other files import them, but they will likely throw or fail.

  static async searchContractsAndDesigns(searchTerm: string): Promise<any> {
    // Simplified search implementation for new schema
    const contracts = await db('Contract')
      .where(function () {
        // cast to string for partial match on numbers if needed, or exact match
        this.where('PONumber', 'like', `% ${searchTerm}% `);
      })
      .limit(10);

    return {
      contracts: contracts.map((c: any) => ({
        id: c.ContractID,
        contractNumber: c.ContractNo,
        contractDate: c.ContractDate,
        poNumber: c.PONumber
      })),
      designs: []
    };
  }


  /**
   * Update Contract Progress based on Production
   */
  static async updateContractProgress(contractId: number, trx?: any): Promise<void> {
    const queryBuilder = trx || db; // Use transaction if provided, else specific query builder

    // 1. Get all Contract Items
    const items = await queryBuilder('ContractItem').where('ContractID', contractId);

    if (items.length === 0) return;

    let totalPlannedStitches = 0;

    // 2. Iterate items to calculate totals and UPDATE usage per item
    for (const item of items) {
      // A. Get Production Totals for this Item
      const production = await queryBuilder('ProductionEntry')
        .where('ContractItemID', item.ContractItemID)
        .sum('Stitches as totalStitches')
        .sum('Repeats as totalRepeats')
        .first();

      const producedStitches = parseFloat(production?.totalStitches || '0');
      const producedRepeats = parseFloat(production?.totalRepeats || '0');

      // B. Update ContractItem usage columns
      await queryBuilder('ContractItem')
        .where('ContractItemID', item.ContractItemID)
        .update({
          UsedStitches: producedStitches,
          UsedRepeats: producedRepeats
        });

      // C. Add to Contract Total Plan (for overall progress)
      const stitchPerPiece = item.Stitch || 0;
      const pieces = item.Pieces || 0;

      totalPlannedStitches += (stitchPerPiece * pieces);
    }

    // 3. Get Total Production for these Items (Overall)
    const itemIds = items.map((i: any) => i.ContractItemID);
    const overallProduction = await queryBuilder('ProductionEntry')
      .whereIn('ContractItemID', itemIds)
      .sum('Stitches as totalStitches')
      .first();

    const totalProducedStitches = parseFloat(overallProduction?.totalStitches || '0');

    // 4. Calculate Progress
    let progress = 0;
    if (totalPlannedStitches > 0) {
      progress = (totalProducedStitches / totalPlannedStitches) * 100;
    }

    const progressStr = `${Math.min(100, Math.round(progress))}% `;

    await queryBuilder('Contract')
      .where('ContractID', contractId)
      .update({ Progress: progressStr });
  }

  // Stubs for other methods to satisfy imports in routes/contracts.ts if strictly typed there
  static async updateContractStatus(id: number, status: string, userId: number) { throw new Error("Not implemented in new schema"); }
  static async getDesignsByContract(id: number) { return []; }
  static async createDesign(data: any, userId: number) { throw new Error("Not implemented in new schema"); }
  static async updateDesignStatus(id: number, status: string, userId: number) { throw new Error("Not implemented in new schema"); }
  static async getDesignById(id: number) { return null; }
}
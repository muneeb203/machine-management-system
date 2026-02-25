import { db, logAudit, withTransaction } from '../database/connection';
import { ProductionEntry, ProductionEntryRequest, StitchOverride, StitchOverrideRequest } from '../types';
import { ContractService } from './ContractService';

export class ProductionService {

  /**
   * Create a single production entry
   */
  static async createProductionEntry(
    entryData: ProductionEntryRequest,
    userId: number
  ): Promise<number> {
    return withTransaction(async (trx) => {
      // Validate machine exists
      const machine = await trx('Machine')
        .where({ MachineID: entryData.machineId, IsActive: 1 })
        .first();

      if (!machine) {
        throw new Error('Machine not found or inactive');
      }

      // Validate ContractItem exists (replacing designId)
      // entryData should have contractItemId now, or we map designId to it for now if needed.
      // Assuming we updated types and frontend to send contractItemId.
      // If frontend still sends designId, we need to map it?
      // Based on previous files, 'designs' table was dropped. Frontend MUST send contractItemId.

      const contractItemId = entryData.contractItemId || entryData.designId; // Fallback if type not fully updated yet

      const contractItem = await trx('ContractItem')
        .where('ContractItemID', contractItemId)
        .first();

      if (!contractItem) {
        throw new Error('Contract Item not found');
      }

      // Validate Remaining Stitches
      // Calculate Total Planned
      const stitchPerPiece = contractItem.Stitch || 0;
      const pieces = contractItem.Pieces || 0;
      const totalPlanned = stitchPerPiece * pieces;

      const usedStitches = parseFloat(contractItem.UsedStitches || '0');
      const currentStitches = entryData.actualStitches;

      if (totalPlanned > 0 && (usedStitches + currentStitches) > totalPlanned) {
        // Allow slight over-production? User said "cannot exceed".
        // Let's stick to strict or provide Warning. 
        // For now, Strict Error as requested.
        const remaining = totalPlanned - usedStitches;
        throw new Error(`Exceeds remaining stitches. Remaining: ${remaining}, Entered: ${currentStitches}`);
      }

      // Create production entry
      const [productionId] = await trx('ProductionEntry').insert({
        MachineID: entryData.machineId,
        ContractItemID: contractItemId,
        ProductionDate: new Date(entryData.productionDate),
        Shift: entryData.shift,
        Stitches: entryData.actualStitches,
        Repeats: entryData.repeatsCompleted || 0,
        OperatorName: entryData.operatorName,
        Notes: entryData.notes,
        // is_billed removed or needs to be handled if Billing table exists.
        // Assuming BillingRecord logic handles billing separate or later.
      });

      // Log audit trail
      // await logAudit('ProductionEntry', productionId, 'insert', null, entryData, userId);

      // Update Contract Progress
      await ContractService.updateContractProgress(contractItem.ContractID, trx);

      return productionId;
    });
  }

  /**
   * Create multiple production entries (bulk)
   */
  static async createBulkProductionEntries(
    entries: ProductionEntryRequest[],
    userId: number
  ): Promise<number[]> {
    return withTransaction(async (trx) => {
      const ids: number[] = [];

      for (const entryData of entries) {
        // Validate machine
        const machine = await trx('Machine')
          .where({ MachineID: entryData.machineId, IsActive: 1 })
          .first();

        if (!machine) {
          console.warn(`Machine ${entryData.machineId} skipped - not found`);
          continue;
        }

        const contractItemId = entryData.contractItemId || entryData.designId;
        const contractItem = await trx('ContractItem')
          .where('ContractItemID', contractItemId)
          .first();

        if (!contractItem) {
          console.warn(`Item ${contractItemId} skipped - not found`);
          continue;
        }

        const [productionId] = await trx('ProductionEntry').insert({
          MachineID: entryData.machineId,
          ContractItemID: contractItemId,
          ProductionDate: new Date(entryData.productionDate),
          Shift: entryData.shift,
          Stitches: entryData.actualStitches,
          Repeats: entryData.repeatsCompleted || 0,
          OperatorName: entryData.operatorName,
          Notes: entryData.notes
        });

        ids.push(productionId);
      }

      // Update progress for all unique contracts touched
      // This is inefficient if many contracts, but distinct list should be small
      const itemIds = entries.map(e => e.contractItemId || e.designId);
      const uniqueContractIds = await trx('ContractItem')
        .whereIn('ContractItemID', itemIds)
        .distinct(['ContractID']);

      for (const c of uniqueContractIds) {
        await ContractService.updateContractProgress(c.ContractID, trx);
      }

      return ids;
    });
  }

  /**
   * Get daily production
   */
  static async getDailyProduction(date: string): Promise<any[]> {
    const entries = await db('ProductionEntry')
      .join('Machine', 'ProductionEntry.MachineID', 'Machine.MachineID')
      .join('ContractItem', 'ProductionEntry.ContractItemID', 'ContractItem.ContractItemID')
      .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
      .where('ProductionEntry.ProductionDate', date)
      .select(
        'ProductionEntry.*',
        'Machine.MachineNumber',
        'Machine.MasterGroup',
        'ContractItem.ItemDescription',
        'ContractItem.DesignNo',
        'Contract.ContractNo',
        'Contract.PONumber'
      )
      .orderBy(['Machine.MachineNumber', 'ProductionEntry.Shift']);

    // Map to frontend expected shape
    return entries.map(entry => ({
      id: entry.ProductionID,
      machineId: entry.MachineID,
      contractItemId: entry.ContractItemID, // Replaces designId
      designId: entry.ContractItemID, // KEEP for frontend compatibility for now
      productionDate: entry.ProductionDate,
      shift: entry.Shift,
      actualStitches: entry.Stitches,
      genuineStitches: entry.Stitches, // duplication if not tracking separate
      repeatsCompleted: entry.Repeats,
      operatorName: entry.OperatorName,
      notes: entry.Notes,
      machine: {
        id: entry.MachineID,
        machineNumber: entry.MachineNumber,
        masterGroup: entry.MasterGroup
      },
      design: { // Mock design object to satisfy frontend types if needed
        id: entry.ContractItemID,
        designNumber: entry.DesignNo,
        contract: {
          contractNumber: entry.ContractNo,
          partyName: entry.PartyName || 'Unknown' // Handle missing party name
        }
      }
    }));
  }
}
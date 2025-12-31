import { db, logAudit, withTransaction } from '../database/connection';
import { ProductionEntry, StitchOverride, ProductionEntryRequest, StitchOverrideRequest } from '../types';
import { RateEngine } from './RateEngine';

export class ProductionService {
  
  /**
   * Create a single production entry
   */
  static async createProductionEntry(
    entryData: ProductionEntryRequest,
    userId: number
  ): Promise<ProductionEntry> {
    return withTransaction(async (trx) => {
      // Validate machine exists and is active
      const machine = await trx('machines')
        .where({ id: entryData.machineId, is_active: true })
        .first();
      
      if (!machine) {
        throw new Error('Machine not found or inactive');
      }
      
      // Validate design exists
      const design = await trx('designs')
        .where('id', entryData.designId)
        .whereNull('deleted_at')
        .first();
      
      if (!design) {
        throw new Error('Design not found');
      }
      
      // Create production entry
      const productionEntry = {
        machine_id: entryData.machineId,
        design_id: entryData.designId,
        production_date: new Date(entryData.productionDate),
        shift: entryData.shift,
        actual_stitches: entryData.actualStitches,
        genuine_stitches: entryData.genuineStitches,
        repeats_completed: entryData.repeatsCompleted,
        operator_name: entryData.operatorName,
        notes: entryData.notes,
        is_billed: false,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      const [inserted] = await trx('production_entries')
        .insert(productionEntry)
        .returning('*');
      
      // Log audit trail
      await logAudit('production_entries', inserted.id, 'insert', null, inserted, userId);
      
      // Create billing record automatically
      await RateEngine.createBillingRecord(
        design.contract_id,
        entryData.machineId,
        entryData.designId,
        new Date(entryData.productionDate),
        entryData.shift,
        entryData.actualStitches,
        undefined,
        userId
      );
      
      return {
        id: inserted.id,
        machineId: inserted.machine_id,
        designId: inserted.design_id,
        productionDate: inserted.production_date,
        shift: inserted.shift,
        actualStitches: inserted.actual_stitches,
        genuineStitches: inserted.genuine_stitches,
        repeatsCompleted: inserted.repeats_completed,
        operatorName: inserted.operator_name,
        notes: inserted.notes,
        isBilled: inserted.is_billed,
        createdBy: inserted.created_by,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
      };
    });
  }
  
  /**
   * Create multiple production entries (bulk entry for 22 machines)
   */
  static async createBulkProductionEntries(
    entries: ProductionEntryRequest[],
    userId: number
  ): Promise<ProductionEntry[]> {
    return withTransaction(async (trx) => {
      const results: ProductionEntry[] = [];
      
      for (const entryData of entries) {
        // Validate machine exists and is active
        const machine = await trx('machines')
          .where({ id: entryData.machineId, is_active: true })
          .first();
        
        if (!machine) {
          throw new Error(`Machine ${entryData.machineId} not found or inactive`);
        }
        
        // Validate design exists
        const design = await trx('designs')
          .where('id', entryData.designId)
          .whereNull('deleted_at')
          .first();
        
        if (!design) {
          throw new Error(`Design ${entryData.designId} not found`);
        }
        
        // Create production entry
        const productionEntry = {
          machine_id: entryData.machineId,
          design_id: entryData.designId,
          production_date: new Date(entryData.productionDate),
          shift: entryData.shift,
          actual_stitches: entryData.actualStitches,
          genuine_stitches: entryData.genuineStitches,
          repeats_completed: entryData.repeatsCompleted,
          operator_name: entryData.operatorName,
          notes: entryData.notes,
          is_billed: false,
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date(),
        };
        
        const [inserted] = await trx('production_entries')
          .insert(productionEntry)
          .returning('*');
        
        // Log audit trail
        await logAudit('production_entries', inserted.id, 'insert', null, inserted, userId);
        
        // Create billing record automatically
        await RateEngine.createBillingRecord(
          design.contract_id,
          entryData.machineId,
          entryData.designId,
          new Date(entryData.productionDate),
          entryData.shift,
          entryData.actualStitches,
          undefined,
          userId
        );
        
        results.push({
          id: inserted.id,
          machineId: inserted.machine_id,
          designId: inserted.design_id,
          productionDate: inserted.production_date,
          shift: inserted.shift,
          actualStitches: inserted.actual_stitches,
          genuineStitches: inserted.genuine_stitches,
          repeatsCompleted: inserted.repeats_completed,
          operatorName: inserted.operator_name,
          notes: inserted.notes,
          isBilled: inserted.is_billed,
          createdBy: inserted.created_by,
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
        });
      }
      
      return results;
    });
  }
  
  /**
   * Override stitch count with audit trail
   */
  static async overrideStitchCount(
    overrideData: StitchOverrideRequest,
    userId: number
  ): Promise<StitchOverride> {
    return withTransaction(async (trx) => {
      // Get current production entry
      const productionEntry = await trx('production_entries')
        .where('id', overrideData.productionEntryId)
        .whereNull('deleted_at')
        .first();
      
      if (!productionEntry) {
        throw new Error('Production entry not found');
      }
      
      // Check if already billed and approved
      const design = await trx('designs').where('id', productionEntry.design_id).first();
      const billingRecord = await trx('billing_records')
        .where({
          contract_id: design.contract_id,
          machine_id: productionEntry.machine_id,
          billing_date: productionEntry.production_date,
          shift: productionEntry.shift,
        })
        .first();
      
      if (billingRecord && billingRecord.is_approved) {
        throw new Error('Cannot override stitches for approved billing record');
      }
      
      // Create stitch override record
      const stitchOverride = {
        production_entry_id: overrideData.productionEntryId,
        original_stitches: productionEntry.actual_stitches,
        new_stitches: overrideData.newStitches,
        reason: overrideData.reason,
        override_by: userId,
        override_at: new Date(),
      };
      
      const [insertedOverride] = await trx('stitch_overrides')
        .insert(stitchOverride)
        .returning('*');
      
      // Update production entry
      const oldProductionValues = { ...productionEntry };
      
      await trx('production_entries')
        .where('id', overrideData.productionEntryId)
        .update({
          actual_stitches: overrideData.newStitches,
          updated_at: new Date(),
        });
      
      // Log audit trails
      await logAudit('stitch_overrides', insertedOverride.id, 'insert', null, insertedOverride, userId);
      await logAudit(
        'production_entries', 
        overrideData.productionEntryId, 
        'override', 
        oldProductionValues, 
        { ...oldProductionValues, actual_stitches: overrideData.newStitches }, 
        userId
      );
      
      // Recalculate billing
      await RateEngine.recalculateBillingAfterOverride(
        overrideData.productionEntryId,
        overrideData.newStitches,
        userId
      );
      
      return {
        id: insertedOverride.id,
        productionEntryId: insertedOverride.production_entry_id,
        originalStitches: insertedOverride.original_stitches,
        newStitches: insertedOverride.new_stitches,
        reason: insertedOverride.reason,
        overrideBy: insertedOverride.override_by,
        overrideAt: insertedOverride.override_at,
      };
    });
  }
  
  /**
   * Get daily production for all machines
   */
  static async getDailyProduction(date: string): Promise<ProductionEntry[]> {
    const entries = await db('production_entries')
      .join('machines', 'production_entries.machine_id', 'machines.id')
      .join('designs', 'production_entries.design_id', 'designs.id')
      .join('contracts', 'designs.contract_id', 'contracts.id')
      .where('production_entries.production_date', date)
      .whereNull('production_entries.deleted_at')
      .select(
        'production_entries.*',
        'machines.machine_number',
        'machines.master_group',
        'designs.design_number',
        'designs.component',
        'contracts.contract_number',
        'contracts.party_name'
      )
      .orderBy(['machines.machine_number', 'production_entries.shift']);
    
    return entries.map(entry => ({
      id: entry.id,
      machineId: entry.machine_id,
      designId: entry.design_id,
      productionDate: entry.production_date,
      shift: entry.shift,
      actualStitches: entry.actual_stitches,
      genuineStitches: entry.genuine_stitches,
      repeatsCompleted: entry.repeats_completed,
      operatorName: entry.operator_name,
      notes: entry.notes,
      isBilled: entry.is_billed,
      createdBy: entry.created_by,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      machine: {
        id: entry.machine_id,
        machineNumber: entry.machine_number,
        masterGroup: entry.master_group,
        dayShiftCapacity: 0,
        nightShiftCapacity: 0,
        isActive: true,
        createdAt: new Date(),
      },
      design: {
        id: entry.design_id,
        contractId: entry.contract_id,
        designNumber: entry.design_number,
        component: entry.component,
        repeatType: 'yards' as const,
        plannedQuantity: 0,
        status: 'in_progress' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        contract: {
          id: entry.contract_id,
          contractNumber: entry.contract_number,
          partyName: entry.party_name,
          startDate: new Date(),
          status: 'active' as const,
          createdBy: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    }));
  }
  
  /**
   * Get production summary by machine for a date range
   */
  static async getProductionSummary(
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const summary = await db('production_entries')
      .join('machines', 'production_entries.machine_id', 'machines.id')
      .join('designs', 'production_entries.design_id', 'designs.id')
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
        'machines.id as machine_id',
        'machines.machine_number',
        'machines.master_group',
        'production_entries.shift',
        db.raw('SUM(production_entries.actual_stitches) as total_stitches'),
        db.raw('SUM(billing_records.total_amount) as total_amount'),
        db.raw('COUNT(production_entries.id) as entry_count')
      )
      .orderBy(['machines.machine_number', 'production_entries.shift']);
    
    return summary;
  }
  
  /**
   * Get production entries with overrides
   */
  static async getProductionWithOverrides(productionEntryId: number): Promise<ProductionEntry | null> {
    const entry = await db('production_entries')
      .join('machines', 'production_entries.machine_id', 'machines.id')
      .join('designs', 'production_entries.design_id', 'designs.id')
      .join('contracts', 'designs.contract_id', 'contracts.id')
      .where('production_entries.id', productionEntryId)
      .whereNull('production_entries.deleted_at')
      .select(
        'production_entries.*',
        'machines.machine_number',
        'designs.design_number',
        'contracts.contract_number'
      )
      .first();
    
    if (!entry) return null;
    
    const overrides = await db('stitch_overrides')
      .join('users', 'stitch_overrides.override_by', 'users.id')
      .where('production_entry_id', productionEntryId)
      .select(
        'stitch_overrides.*',
        'users.username'
      )
      .orderBy('override_at', 'desc');
    
    return {
      id: entry.id,
      machineId: entry.machine_id,
      designId: entry.design_id,
      productionDate: entry.production_date,
      shift: entry.shift,
      actualStitches: entry.actual_stitches,
      genuineStitches: entry.genuine_stitches,
      repeatsCompleted: entry.repeats_completed,
      operatorName: entry.operator_name,
      notes: entry.notes,
      isBilled: entry.is_billed,
      createdBy: entry.created_by,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      overrides: overrides.map(override => ({
        id: override.id,
        productionEntryId: override.production_entry_id,
        originalStitches: override.original_stitches,
        newStitches: override.new_stitches,
        reason: override.reason,
        overrideBy: override.override_by,
        overrideAt: override.override_at,
        user: {
          id: override.override_by,
          username: override.username,
          email: '',
          role: 'operator' as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })),
    };
  }
}
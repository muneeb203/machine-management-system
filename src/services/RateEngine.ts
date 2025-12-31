import { db, logAudit } from '../database/connection';
import { BaseRate, RateElement, DesignRateElement, BillingRecord } from '../types';

export class RateEngine {
  
  /**
   * Calculate effective rate for a design based on selected rate elements
   */
  static async calculateEffectiveRate(designId: number): Promise<number> {
    // Get current base rate
    const baseRate = await this.getCurrentBaseRate();
    
    // Get selected rate elements for this design
    const selectedElements = await db('design_rate_elements')
      .where({ design_id: designId, is_selected: true })
      .select('rate_per_stitch');
    
    // Sum all selected element rates
    const elementRatesSum = selectedElements.reduce(
      (sum, element) => sum + parseFloat(element.rate_per_stitch), 
      0
    );
    
    return baseRate.ratePerStitch + elementRatesSum;
  }
  
  /**
   * Get current active base rate
   */
  static async getCurrentBaseRate(): Promise<BaseRate> {
    const baseRate = await db('base_rates')
      .where('is_active', true)
      .where('effective_from', '<=', new Date())
      .where(function() {
        this.whereNull('effective_to').orWhere('effective_to', '>=', new Date());
      })
      .orderBy('effective_from', 'desc')
      .first();
    
    if (!baseRate) {
      throw new Error('No active base rate found');
    }
    
    return {
      id: baseRate.id,
      ratePerStitch: parseFloat(baseRate.rate_per_stitch),
      effectiveFrom: baseRate.effective_from,
      effectiveTo: baseRate.effective_to,
      isActive: baseRate.is_active,
      createdBy: baseRate.created_by,
      createdAt: baseRate.created_at,
    };
  }
  
  /**
   * Calculate billing amount for production entry
   */
  static async calculateBillingAmount(
    designId: number, 
    actualStitches: number
  ): Promise<{ baseRate: number; elementRates: number; effectiveRate: number; totalAmount: number }> {
    const baseRate = await this.getCurrentBaseRate();
    
    const selectedElements = await db('design_rate_elements')
      .where({ design_id: designId, is_selected: true })
      .select('rate_per_stitch');
    
    const elementRatesSum = selectedElements.reduce(
      (sum, element) => sum + parseFloat(element.rate_per_stitch), 
      0
    );
    
    const effectiveRate = baseRate.ratePerStitch + elementRatesSum;
    const totalAmount = actualStitches * effectiveRate;
    
    return {
      baseRate: baseRate.ratePerStitch,
      elementRates: elementRatesSum,
      effectiveRate,
      totalAmount,
    };
  }
  
  /**
   * Create billing record for production entry
   */
  static async createBillingRecord(
    contractId: number,
    machineId: number,
    designId: number,
    billingDate: Date,
    shift: 'day' | 'night',
    actualStitches: number,
    gatePassId?: number,
    userId?: number
  ): Promise<BillingRecord> {
    const billing = await this.calculateBillingAmount(designId, actualStitches);
    
    const billingRecord = {
      contract_id: contractId,
      machine_id: machineId,
      billing_date: billingDate,
      shift,
      total_stitches: actualStitches,
      base_rate: billing.baseRate,
      element_rates: billing.elementRates,
      effective_rate: billing.effectiveRate,
      total_amount: billing.totalAmount,
      gate_pass_id: gatePassId,
      is_approved: false,
      created_at: new Date(),
    };
    
    const [insertedRecord] = await db('billing_records')
      .insert(billingRecord)
      .returning('*');
    
    // Log audit trail
    if (userId) {
      await logAudit('billing_records', insertedRecord.id, 'insert', null, insertedRecord, userId);
    }
    
    return {
      id: insertedRecord.id,
      contractId: insertedRecord.contract_id,
      machineId: insertedRecord.machine_id,
      billingDate: insertedRecord.billing_date,
      shift: insertedRecord.shift,
      totalStitches: insertedRecord.total_stitches,
      baseRate: parseFloat(insertedRecord.base_rate),
      elementRates: parseFloat(insertedRecord.element_rates),
      effectiveRate: parseFloat(insertedRecord.effective_rate),
      totalAmount: parseFloat(insertedRecord.total_amount),
      gatePassId: insertedRecord.gate_pass_id,
      isApproved: insertedRecord.is_approved,
      approvedBy: insertedRecord.approved_by,
      approvedAt: insertedRecord.approved_at,
      createdAt: insertedRecord.created_at,
    };
  }
  
  /**
   * Recalculate billing after stitch override
   */
  static async recalculateBillingAfterOverride(
    productionEntryId: number,
    newStitches: number,
    userId: number
  ): Promise<void> {
    // Get production entry details
    const productionEntry = await db('production_entries')
      .join('designs', 'production_entries.design_id', 'designs.id')
      .where('production_entries.id', productionEntryId)
      .select(
        'production_entries.*',
        'designs.contract_id'
      )
      .first();
    
    if (!productionEntry) {
      throw new Error('Production entry not found');
    }
    
    // Find existing billing record
    const existingBilling = await db('billing_records')
      .where({
        contract_id: productionEntry.contract_id,
        machine_id: productionEntry.machine_id,
        billing_date: productionEntry.production_date,
        shift: productionEntry.shift,
      })
      .first();
    
    if (existingBilling && existingBilling.is_approved) {
      throw new Error('Cannot modify approved billing record');
    }
    
    // Calculate new billing amounts
    const newBilling = await this.calculateBillingAmount(
      productionEntry.design_id, 
      newStitches
    );
    
    if (existingBilling) {
      // Update existing billing record
      const oldValues = { ...existingBilling };
      
      await db('billing_records')
        .where('id', existingBilling.id)
        .update({
          total_stitches: newStitches,
          base_rate: newBilling.baseRate,
          element_rates: newBilling.elementRates,
          effective_rate: newBilling.effectiveRate,
          total_amount: newBilling.totalAmount,
          updated_at: new Date(),
        });
      
      // Log audit trail
      await logAudit(
        'billing_records', 
        existingBilling.id, 
        'update', 
        oldValues, 
        { ...oldValues, total_stitches: newStitches, total_amount: newBilling.totalAmount }, 
        userId
      );
    } else {
      // Create new billing record
      await this.createBillingRecord(
        productionEntry.contract_id,
        productionEntry.machine_id,
        productionEntry.design_id,
        productionEntry.production_date,
        productionEntry.shift,
        newStitches,
        undefined,
        userId
      );
    }
  }
  
  /**
   * Approve billing record (makes it immutable)
   */
  static async approveBillingRecord(
    billingRecordId: number,
    approvedBy: number
  ): Promise<void> {
    const existingRecord = await db('billing_records')
      .where('id', billingRecordId)
      .first();
    
    if (!existingRecord) {
      throw new Error('Billing record not found');
    }
    
    if (existingRecord.is_approved) {
      throw new Error('Billing record is already approved');
    }
    
    const oldValues = { ...existingRecord };
    
    await db('billing_records')
      .where('id', billingRecordId)
      .update({
        is_approved: true,
        approved_by: approvedBy,
        approved_at: new Date(),
      });
    
    // Log audit trail
    await logAudit(
      'billing_records', 
      billingRecordId, 
      'update', 
      oldValues, 
      { ...oldValues, is_approved: true, approved_by: approvedBy }, 
      approvedBy
    );
  }
  
  /**
   * Get all rate elements
   */
  static async getAllRateElements(): Promise<RateElement[]> {
    const elements = await db('rate_elements')
      .where('is_active', true)
      .orderBy('name');
    
    return elements.map(element => ({
      id: element.id,
      name: element.name,
      description: element.description,
      ratePerStitch: parseFloat(element.rate_per_stitch),
      isActive: element.is_active,
      createdBy: element.created_by,
      createdAt: element.created_at,
      updatedAt: element.updated_at,
    }));
  }
  
  /**
   * Create or update rate element (Admin only)
   */
  static async upsertRateElement(
    element: Partial<RateElement>,
    userId: number
  ): Promise<RateElement> {
    const elementData = {
      name: element.name,
      description: element.description,
      rate_per_stitch: element.ratePerStitch,
      is_active: element.isActive ?? true,
      created_by: userId,
      updated_at: new Date(),
    };
    
    if (element.id) {
      // Update existing
      const oldValues = await db('rate_elements').where('id', element.id).first();
      
      await db('rate_elements')
        .where('id', element.id)
        .update(elementData);
      
      await logAudit('rate_elements', element.id, 'update', oldValues, elementData, userId);
      
      const updated = await db('rate_elements').where('id', element.id).first();
      return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        ratePerStitch: parseFloat(updated.rate_per_stitch),
        isActive: updated.is_active,
        createdBy: updated.created_by,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      };
    } else {
      // Create new
      const newElementData = {
        ...elementData,
        created_at: new Date(),
      };
      
      const [inserted] = await db('rate_elements')
        .insert(newElementData)
        .returning('*');
      
      await logAudit('rate_elements', inserted.id, 'insert', null, inserted, userId);
      
      return {
        id: inserted.id,
        name: inserted.name,
        description: inserted.description,
        ratePerStitch: parseFloat(inserted.rate_per_stitch),
        isActive: inserted.is_active,
        createdBy: inserted.created_by,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
      };
    }
  }
}
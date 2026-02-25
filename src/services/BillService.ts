import { db, withTransaction, logAudit } from '../database/connection';

/**
 * Rate type enumeration
 */
export type RateType = 'HDS' | 'SHEET' | 'FUSING';

/**
 * Bill header interface
 */
export interface Bill {
    bill_id?: number;
    bill_number?: string;
    bill_date: string;
    party_name: string;
    po_number?: string;
    contract_id?: number;
    created_by?: number;
    created_at?: Date;
    updated_at?: Date;
}

/**
 * Bill item interface
 */
export interface BillItem {
    bill_item_id?: number;
    bill_id: number;
    design_no?: string;
    collection?: string;
    component?: string;
    item_description?: string;
    qty?: number;
    stitches: number;
    rate_per_unit: number;
    rate_type: RateType;
    amount: number;
    formula_details?: any;
    created_at?: Date;
    updated_at?: Date;
}

/**
 * Formula calculation details for audit trail
 */
interface FormulaDetails {
    stitches: number;
    rate: number;
    formula: string;
    calculation: string;
    result: number;
}

/**
 * BillService - Handles all billing operations with formula calculations
 */
export class BillService {
    /**
     * Calculate amount based on rate type
     * HDS: stitches * rate * 0.1
     * SHEET: stitches * rate * 0.277
     * FUSING: 100 * rate (independent of stitches)
     */
    static calculateAmount(stitches: number, rate: number, rateType: RateType): { amount: number; details: FormulaDetails } {
        let amount: number;
        let formula: string;
        let calculation: string;

        switch (rateType) {
            case 'HDS':
                formula = 'stitches * rate * 0.1';
                amount = stitches * rate * 0.1;
                calculation = `${stitches} * ${rate} * 0.1`;
                break;

            case 'SHEET':
                formula = 'stitches * rate * 0.277';
                amount = stitches * rate * 0.277;
                calculation = `${stitches} * ${rate} * 0.277`;
                break;

            case 'FUSING':
                formula = '100 * rate';
                amount = 100 * rate;
                calculation = `100 * ${rate}`;
                break;

            default:
                throw new Error(`Invalid rate type: ${rateType}`);
        }

        // Round to 2 decimal places
        amount = Math.round(amount * 100) / 100;

        const details: FormulaDetails = {
            stitches,
            rate,
            formula,
            calculation,
            result: amount
        };

        return { amount, details };
    }

    /**
     * Generate unique bill number
     */
    static async generateBillNumber(): Promise<string> {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        // Format: BILL-YYYYMMDD-XXX
        const prefix = `BILL-${year}${month}${day}`;

        // Find the highest number for today
        const existing = await db('bill')
            .where('bill_number', 'like', `${prefix}%`)
            .orderBy('bill_number', 'desc')
            .first();

        let sequence = 1;
        if (existing) {
            const lastNumber = existing.bill_number.split('-').pop();
            sequence = parseInt(lastNumber || '0') + 1;
        }

        return `${prefix}-${String(sequence).padStart(3, '0')}`;
    }

    /**
     * Create a new bill with all its items in a single transaction
     */
    static async createFullBill(
        billData: Omit<Bill, 'bill_id' | 'created_at' | 'updated_at'>,
        items: Omit<BillItem, 'bill_item_id' | 'bill_id' | 'amount' | 'formula_details' | 'created_at' | 'updated_at'>[],
        userId: number
    ): Promise<number> {
        return withTransaction(async (trx) => {
            // Generate bill number if not provided
            const billNumber = billData.bill_number || await this.generateBillNumber();

            const [billId] = await trx('bill').insert({
                bill_number: billNumber,
                bill_date: billData.bill_date,
                party_name: billData.party_name,
                po_number: billData.po_number || null,
                contract_id: billData.contract_id || null,
                created_by: userId
            });

            // Insert all items
            if (items && items.length > 0) {
                for (const itemData of items) {
                    const { amount, details } = this.calculateAmount(
                        itemData.stitches,
                        itemData.rate_per_unit,
                        itemData.rate_type
                    );

                    await trx('bill_item').insert({
                        bill_id: billId,
                        design_no: itemData.design_no || null,
                        collection: (itemData as any).collection || null,
                        component: (itemData as any).component || null,
                        item_description: itemData.item_description || null,
                        qty: itemData.qty || 0,
                        stitches: itemData.stitches,
                        rate_per_unit: itemData.rate_per_unit,
                        rate_type: itemData.rate_type,
                        amount: amount,
                        formula_details: JSON.stringify(details)
                    });
                }
            }

            await logAudit('bill', billId, 'insert', null, { billData, itemsCount: items?.length || 0 }, userId);

            return billId;
        });
    }

    /**
     * Create a new bill header
     */
    static async createBill(billData: Omit<Bill, 'bill_id' | 'created_at' | 'updated_at'>, userId: number): Promise<number> {
        return withTransaction(async (trx) => {
            // Generate bill number if not provided
            const billNumber = billData.bill_number || await this.generateBillNumber();

            const [billId] = await trx('bill').insert({
                bill_number: billNumber,
                bill_date: billData.bill_date,
                party_name: billData.party_name,
                po_number: billData.po_number || null,
                contract_id: billData.contract_id || null,
                created_by: userId
            });

            await logAudit('bill', billId, 'insert', null, billData, userId);

            return billId;
        });
    }

    /**
     * Update bill header
     */
    static async updateBill(
        billId: number,
        billData: Partial<Omit<Bill, 'bill_id' | 'bill_number' | 'created_at' | 'updated_at'>>,
        userId: number
    ): Promise<void> {
        return withTransaction(async (trx) => {
            const existing = await trx('bill').where({ bill_id: billId }).first();

            if (!existing) {
                throw new Error(`Bill with ID ${billId} not found`);
            }

            await trx('bill')
                .where({ bill_id: billId })
                .update({
                    bill_date: billData.bill_date ?? existing.bill_date,
                    party_name: billData.party_name ?? existing.party_name,
                    po_number: billData.po_number ?? existing.po_number,
                    contract_id: billData.contract_id ?? existing.contract_id,
                    updated_at: trx.fn.now()
                });

            await logAudit('bill', billId, 'update', existing, billData, userId);
        });
    }

    /**
     * Add item to bill with automatic amount calculation
     */
    static async addBillItem(
        billId: number,
        itemData: Omit<BillItem, 'bill_item_id' | 'bill_id' | 'amount' | 'formula_details' | 'created_at' | 'updated_at'>,
        userId: number
    ): Promise<BillItem> {
        return withTransaction(async (trx) => {
            // Server-side calculation (ignore any client-provided amount)
            const { amount, details } = this.calculateAmount(
                itemData.stitches,
                itemData.rate_per_unit,
                itemData.rate_type
            );

            const [itemId] = await trx('bill_item').insert({
                bill_id: billId,
                design_no: itemData.design_no || null,
                collection: (itemData as any).collection || null,
                component: (itemData as any).component || null,
                item_description: itemData.item_description || null,
                qty: itemData.qty || 0,
                stitches: itemData.stitches,
                rate_per_unit: itemData.rate_per_unit,
                rate_type: itemData.rate_type,
                amount: amount,
                formula_details: JSON.stringify(details)
            });

            await logAudit('bill_item', itemId, 'insert', null, { ...itemData, amount, formula_details: details }, userId);

            // Return the created item
            const createdItem = await trx('bill_item').where({ bill_item_id: itemId }).first();
            return createdItem;
        });
    }

    /**
     * Get bill with all items
     */
    static async getBillWithItems(billId: number): Promise<{ bill: Bill; items: BillItem[] }> {
        const bill = await db('bill').where({ bill_id: billId }).first();

        if (!bill) {
            throw new Error(`Bill with ID ${billId} not found`);
        }

        const items = await db('bill_item')
            .where({ bill_id: billId })
            .orderBy('bill_item_id', 'asc');

        return { bill, items };
    }

    /**
     * Update bill item with recalculation
     */
    static async updateBillItem(
        itemId: number,
        itemData: Partial<Omit<BillItem, 'bill_item_id' | 'bill_id' | 'amount' | 'formula_details'>>,
        userId: number
    ): Promise<BillItem> {
        return withTransaction(async (trx) => {
            const existing = await trx('bill_item').where({ bill_item_id: itemId }).first();

            if (!existing) {
                throw new Error(`Bill item with ID ${itemId} not found`);
            }

            // Merge with existing data
            const updatedData = {
                stitches: itemData.stitches ?? existing.stitches,
                rate_per_unit: itemData.rate_per_unit ?? existing.rate_per_unit,
                rate_type: itemData.rate_type ?? existing.rate_type,
                design_no: itemData.design_no ?? existing.design_no,
                collection: (itemData as any).collection ?? existing.collection,
                component: (itemData as any).component ?? existing.component,
                item_description: itemData.item_description ?? existing.item_description,
                qty: itemData.qty ?? existing.qty
            };

            // Recalculate amount
            const { amount, details } = this.calculateAmount(
                updatedData.stitches,
                updatedData.rate_per_unit,
                updatedData.rate_type
            );

            await trx('bill_item')
                .where({ bill_item_id: itemId })
                .update({
                    ...updatedData,
                    amount: amount,
                    formula_details: JSON.stringify(details),
                    updated_at: trx.fn.now()
                });

            await logAudit('bill_item', itemId, 'update', existing, updatedData, userId);

            const updated = await trx('bill_item').where({ bill_item_id: itemId }).first();
            return updated;
        });
    }

    /**
     * Delete bill item
     */
    static async deleteBillItem(itemId: number, userId: number): Promise<void> {
        return withTransaction(async (trx) => {
            const existing = await trx('bill_item').where({ bill_item_id: itemId }).first();

            if (!existing) {
                throw new Error(`Bill item with ID ${itemId} not found`);
            }

            await trx('bill_item').where({ bill_item_id: itemId }).delete();
            await logAudit('bill_item', itemId, 'delete', existing, null, userId);
        });
    }

    /**
     * Get all bills with pagination
     */
    static async getAllBills(page: number = 1, limit: number = 20): Promise<{ bills: Bill[]; total: number }> {
        const offset = (page - 1) * limit;

        const bills = await db('bill')
            .orderBy('bill_date', 'desc')
            .limit(limit)
            .offset(offset);

        const [{ count }] = await db('bill').count('* as count');

        return {
            bills,
            total: Number(count)
        };
    }

    /**
     * Delete bill (cascades to items)
     */
    static async deleteBill(billId: number, userId: number): Promise<void> {
        return withTransaction(async (trx) => {
            const existing = await trx('bill').where({ bill_id: billId }).first();

            if (!existing) {
                throw new Error(`Bill with ID ${billId} not found`);
            }

            await trx('bill').where({ bill_id: billId }).delete();
            await logAudit('bill', billId, 'delete', existing, null, userId);
        });
    }
}

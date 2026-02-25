import db, { withTransaction } from '../database/connection';

export interface ClippingItemData {
    contractItemId: number;
    description: string;
    quantitySent: number;
    dateSent: string; // ISO Date string
    id?: number; // Added for updates
}

export interface CreateClippingRequest {
    vendorId?: number; // New Way
    vendorName?: string; // Legacy/Fallback (though we prefer selection)
    contactNumber?: string;
    cnic?: string;
    address?: string;
    items: ClippingItemData[];
}

export class ClippingService {

    /**
     * Create a new Clipping record (Outsource Work)
     */
    static async createClip(data: CreateClippingRequest, userId: number): Promise<number> {
        return withTransaction(async (trx) => {

            // Resolve Vendor ID
            let vendorId = data.vendorId;
            let vendorName = data.vendorName;
            let contactNumber = data.contactNumber;
            let cnic = data.cnic;
            let address = data.address;

            // If VendorID provided, fetch details to ensure consistency/fill legacy if needed
            if (vendorId) {
                const vendor = await trx('ClippingVendors').where('id', vendorId).first();
                if (vendor) {
                    vendorName = vendor.vendor_name;
                    contactNumber = vendor.contact_number; // Keep legacy columns in sync for now if they exist
                    cnic = vendor.cnic;
                    address = vendor.address;
                }
            } else if (vendorName && contactNumber) {
                // Should we auto-create vendor? 
                // For now, let's assume UI forces selection, but if ad-hoc allowed:
                // Check if contact exists
                const existingVendor = await trx('ClippingVendors').where('contact_number', contactNumber).first();
                if (existingVendor) {
                    vendorId = existingVendor.id;
                } else {
                    // Create new vendor on the fly (optional feature, but safe)
                    const [newVendorId] = await trx('ClippingVendors').insert({
                        vendor_name: vendorName,
                        contact_number: contactNumber,
                        cnic: cnic,
                        address: address,
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    vendorId = newVendorId;
                }
            }

            // 1. Insert Header
            const [clippingId] = await trx('Clipping').insert({
                VendorID: vendorId,
                VendorName: vendorName, // Keeping legacy populated for safety
                ContactNumber: contactNumber,
                CNIC: cnic,
                Address: address,
                CreatedAt: new Date(),
                UpdatedAt: new Date()
            });

            // 2. Insert Items
            const itemsToInsert = data.items.map(item => ({
                ClippingID: clippingId,
                ContractItemID: item.contractItemId,
                Description: item.description,
                QuantitySent: item.quantitySent,
                DateSent: new Date(item.dateSent),
                QuantityReceived: 0,
                Status: 'Sent'
            }));

            if (itemsToInsert.length > 0) {
                await trx('ClippingItem').insert(itemsToInsert);
            }

            return clippingId;
        });
    }

    /**
     * Get all clips (with optional filtering)
     */
    static async getAllClips(vendorName?: string) {
        let query = db('Clipping')
            .leftJoin('ClippingVendors', 'Clipping.VendorID', 'ClippingVendors.id')
            .orderBy('Clipping.CreatedAt', 'desc')
            .select(
                'Clipping.*',
                'ClippingVendors.vendor_name as JoinedVendorName',
                'ClippingVendors.contact_number as JoinedContactNumber'
            );

        if (vendorName) {
            query = query.where(builder => {
                builder.where('Clipping.VendorName', 'like', `%${vendorName}%`)
                    .orWhere('ClippingVendors.vendor_name', 'like', `%${vendorName}%`);
            });
        }

        const clips = await query;

        const clipsWithItems = await Promise.all(clips.map(async (clip) => {
            const items = await db('ClippingItem')
                .join('ContractItem', 'ClippingItem.ContractItemID', 'ContractItem.ContractItemID')
                .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
                .where('ClippingItem.ClippingID', clip.ClippingID)
                .select(
                    'ClippingItem.*',
                    'Contract.ContractID as contractId',
                    'Contract.ContractNo',
                    'Contract.PONumber',
                    'ContractItem.ItemDescription as ContractItemName',
                    'ContractItem.Collection',
                    'ContractItem.DesignNo',
                    'ContractItem.Component',
                    db.raw('COALESCE(ContractItem.Yards, 0) as yard')
                );

            return {
                id: clip.ClippingID,
                vendorId: clip.VendorID,
                vendorName: clip.JoinedVendorName || clip.VendorName, // Prefer joined, fallback to legacy
                contactNumber: clip.JoinedContactNumber || clip.ContactNumber,
                cnic: clip.CNIC,
                address: clip.Address,
                createdAt: clip.CreatedAt,
                items: items.map(item => {
                    // Handle different key casing from DB (MySQL may return Collection vs collection, etc.)
                    const getVal = (obj: any, ...keys: string[]) => {
                        for (const k of keys) {
                            const v = obj[k];
                            if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
                        }
                        return null;
                    };
                    const collection = getVal(item, 'Collection', 'collection');
                    const designNo = getVal(item, 'DesignNo', 'designNo');
                    const component = getVal(item, 'Component', 'component');
                    return {
                        id: item.ClippingItemID,
                        contractItemId: item.ContractItemID,
                        contractId: item.contractId,
                        contractInfo: `#${item.ContractNo} (PO: ${item.PONumber}) - ${item.ContractItemName}`,
                        description: item.Description,
                        collection: collection ?? null,
                        designNo: designNo ?? null,
                        component: component ?? null,
                        yard: item.yard ?? item.Yard ?? null,
                        quantitySent: item.QuantitySent,
                        dateSent: item.DateSent,
                        quantityReceived: item.QuantityReceived,
                        lastReceivedDate: item.LastReceivedDate,
                        status: item.Status
                    };
                })
            };
        }));

        return clipsWithItems;
    }

    /**
     * Receive Work (Update quantity received)
     */
    static async receiveWork(
        clippingId: number,
        itemId: number,
        receivedQty: number,
        receivedDate: string
    ): Promise<void> {
        return withTransaction(async (trx) => {
            const item = await trx('ClippingItem').where({ ClippingItemID: itemId, ClippingID: clippingId }).first();

            if (!item) throw new Error("Clipping Item not found");

            const newTotalReceived = parseFloat(item.QuantityReceived) + receivedQty;
            const sentQty = parseFloat(item.QuantitySent);

            if (newTotalReceived > sentQty) {
                throw new Error(`Cannot receive more than sent. Sent: ${sentQty}, Already Received: ${item.QuantityReceived}, New: ${receivedQty}`);
            }

            let newStatus = 'Partially Received';
            if (newTotalReceived >= sentQty) {
                newStatus = 'Completed';
            }

            await trx('ClippingItem')
                .where('ClippingItemID', itemId)
                .update({
                    QuantityReceived: newTotalReceived,
                    LastReceivedDate: new Date(receivedDate),
                    Status: newStatus
                });
        });
    }

    /**
     * Update an existing Clip
     */
    static async updateClip(clipId: number, data: CreateClippingRequest, userId: number): Promise<void> {
        return withTransaction(async (trx) => {

            // Resolve Vendor ID Updates
            const updatePayload: any = {
                UpdatedAt: new Date()
            };

            if (data.vendorId) {
                updatePayload.VendorID = data.vendorId;
                const vendor = await trx('ClippingVendors').where('id', data.vendorId).first();
                if (vendor) {
                    // Sync legacy
                    updatePayload.VendorName = vendor.vendor_name;
                    updatePayload.ContactNumber = vendor.contact_number;
                    updatePayload.CNIC = vendor.cnic;
                    updatePayload.Address = vendor.address;
                }
            } else {
                // If manual values provided (should restrict this if we want strict Vendor management, but be flexible)
                if (data.vendorName) updatePayload.VendorName = data.vendorName;
                if (data.contactNumber) updatePayload.ContactNumber = data.contactNumber;
                if (data.cnic) updatePayload.CNIC = data.cnic;
                if (data.address) updatePayload.Address = data.address;
            }

            // 1. Update Header
            await trx('Clipping')
                .where('ClippingID', clipId)
                .update(updatePayload);

            // 2. Diff Items (Upsert + Delete removed - only items with no received quantity)
            const existingItems = await trx('ClippingItem').where('ClippingID', clipId).select('ClippingItemID', 'QuantityReceived');
            const payloadItemIds = (data.items || [])
                .filter((it: any) => it.id)
                .map((it: any) => it.id) as number[];
            const idsToDelete = existingItems
                .filter((row: any) => !payloadItemIds.includes(row.ClippingItemID) && (!row.QuantityReceived || Number(row.QuantityReceived) === 0))
                .map((row: any) => row.ClippingItemID);

            if (idsToDelete.length > 0) {
                await trx('ClippingItem').whereIn('ClippingItemID', idsToDelete).del();
            }

            if (data.items && data.items.length > 0) {
                for (const item of data.items) {
                    if (item.id) {
                        // Update existing item
                        await trx('ClippingItem')
                            .where('ClippingItemID', item.id)
                            .update({
                                ContractItemID: item.contractItemId,
                                Description: item.description,
                                QuantitySent: item.quantitySent,
                                DateSent: new Date(item.dateSent)
                            });
                    } else {
                        // Insert new item
                        await trx('ClippingItem').insert({
                            ClippingID: clipId,
                            ContractItemID: item.contractItemId,
                            Description: item.description,
                            QuantitySent: item.quantitySent,
                            DateSent: new Date(item.dateSent),
                            QuantityReceived: 0,
                            Status: 'Sent'
                        });
                    }
                }
            }
        });
    }
}

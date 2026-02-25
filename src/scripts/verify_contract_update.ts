// @ts-nocheck
import { ContractService } from '../services/ContractService';
import { db } from '../database/connection';

async function main() {
    try {
        console.log('--- Starting Contract Update Verification ---');

        // 1. Create a Contract
        console.log('1. Creating new contract...');
        const contractId = await ContractService.createContract({
            contractNumber: 99999,
            contractDate: '2026-01-01',
            contractEndDate: '2026-02-01',
            contractDuration: 30,
            poNumber: 'TEST-PO-999',
            items: [
                {
                    itemDescription: 'Test Item 1',
                    fabric: 'Cotton',
                    color: 'White',
                    repeat: 10,
                    pieces: 100,
                    yard: 50,
                }
            ]
        } as any, 1);
        console.log(`Contract created with ID: ${contractId}`);

        // Fetch to get IDs
        const createdContract = await ContractService.getContractById(contractId);
        const existingItemId = createdContract?.items?.[0]?.id;
        console.log(`Existing Item ID: ${existingItemId}`);

        // 2. Update the Contract
        console.log('2. Updating contract...');
        const updatePayload = {
            contractDate: '2026-01-02',
            contractEndDate: '2026-02-02',
            contractDuration: 31,
            poNumber: 'TEST-PO-999-UPDATED',
            items: [
                {
                    id: existingItemId, // Pass existing ID to trigger UPDATE
                    ContractItemID: existingItemId, // Alternate naming check
                    itemDescription: 'Test Item 1 Updated',
                    fabric: 'Cotton Updated',
                    color: 'White',
                    repeat: 12,
                    pieces: 120,
                    yard: 60,
                },
                {
                    // No ID -> Insert New
                    itemDescription: 'New Item 2',
                    fabric: 'Silk',
                    color: 'Red',
                    repeat: 5,
                    pieces: 50,
                    yard: 25,
                }
            ]
        };

        await ContractService.updateContract(contractId, updatePayload, 1);
        console.log('Contract updated successfully.');

        // 3. Verify Update
        console.log('3. Verifying update...');
        const updated = await ContractService.getContractById(contractId);
        if (!updated) throw new Error('Contract not found after update');

        if (updated.items && updated.items.length === 2) {
            console.log('Update verified: 2 items found.');
        } else {
            console.error('Update failed: Item count mismatch.', updated.items?.length);
        }

        // Cleanup
        console.log('4. Cleanup...');
        await ContractService.deleteContract(contractId, 1); // Soft delete
        // Hard delete for cleanup if needed, but soft is fine for test

    } catch (error) {
        console.error('VERIFICATION FAILED:', error);
    } finally {
        await db.destroy();
    }
}

main();

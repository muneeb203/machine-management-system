import { BillService } from './src/services/BillService';
import { db } from './src/database/connection';

async function test() {
    try {
        console.log('Testing bill creation...');
        const billData = {
            bill_date: new Date().toISOString().split('T')[0],
            party_name: 'Test Party ' + Date.now(),
            po_number: 'PO-' + Date.now()
        };
        const userId = 1; // Assuming user with ID 1 exists

        const billId = await BillService.createBill(billData, userId);
        console.log('Bill created successfully, ID:', billId);

        const result = await BillService.getBillWithItems(billId);
        console.log('Bill fetched successfully:', JSON.stringify(result.bill, null, 2));
    } catch (error) {
        console.error('Error during bill creation test:');
        console.error(error);
    } finally {
        await db.destroy();
    }
}

test();

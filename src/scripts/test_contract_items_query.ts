
import { db } from '../database/connection';

async function testQuery() {
    try {
        console.log('Testing Contract Items Query...');
        const q = ''; // Empty search
        const limit = 5;
        const offset = 0;

        const items = await db('ContractItem')
            .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
            .select(
                'ContractItem.ContractItemID as contractItemId',
                'Contract.ContractID as contractId',
                'Contract.ContractNo as contractNo',
                'ContractItem.Collection as collection',
                // db.raw('COALESCE(ContractItem.DesignNo, ContractItem.ItemDescription) as itemLabel') 
                // Note: db.raw might need specific import or usage depending on knex instance, but usually works on instance.
            )
            .where('Contract.IsActive', 1)
            .limit(limit)
            .offset(offset);

        console.log('Query successful. Result count:', items.length);
        if (items.length > 0) {
            console.log('First item:', items[0]);
        }
    } catch (error) {
        console.error('Query failed:', error);
    } finally {
        await db.destroy();
    }
}

testQuery();

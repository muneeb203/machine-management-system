const knex = require('knex');
const config = require('./knexfile');

async function check() {
    const db = knex(config.development);
    try {
        const [contractDesc] = await db.raw('DESCRIBE Contract');
        console.log('--- Contract ---');
        const contractID = contractDesc.find(col => col.Field === 'ContractID');
        if (contractID) {
            console.log(`ContractID: ${contractID.Type}`);
        } else {
            console.log('ContractID not found');
        }

        const [billingDesc] = await db.raw('DESCRIBE daily_billing_records');
        console.log('--- daily_billing_records ---');
        const contractIdBilling = billingDesc.find(col => col.Field === 'contract_id');
        if (contractIdBilling) {
            console.log(`contract_id: ${contractIdBilling.Type}`);
        } else {
            console.log('contract_id not found');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.destroy();
    }
}

check();

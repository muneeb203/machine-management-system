const knex = require('knex');
const config = require('./knexfile');

async function check() {
    const db = knex(config.development);
    try {
        console.log('--- TABLE DESC: Contract ---');
        const [contractDesc] = await db.raw('DESCRIBE Contract');
        console.table(contractDesc);

        console.log('--- TABLE DESC: daily_billing_records ---');
        const [billingDesc] = await db.raw('DESCRIBE daily_billing_records');
        console.table(billingDesc);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.destroy();
    }
}

check();

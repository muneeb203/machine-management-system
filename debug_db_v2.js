const knex = require('knex');
const config = require('./knexfile');
const db = knex(config.development);

async function check() {
    try {
        console.log('Connecting to database...');
        const result = await db.raw('SELECT 1');
        console.log('Connection successful:', result[0]);

        const count = await db('daily_billing_records').count('* as count').first();
        console.log('TOTAL RECORDS IN daily_billing_records:', count.count);

        const lastRecords = await db('daily_billing_records').orderBy('id', 'desc').limit(5);
        console.log('LAST 5 RECORDS:', JSON.stringify(lastRecords, null, 2));

        const machineCount = await db('Machine').count('* as count').first();
        console.log('TOTAL MACHINES:', machineCount.count);

        const masterCount = await db('MachineMaster').count('* as count').first();
        console.log('TOTAL MASTERS:', masterCount.count);

        process.exit(0);
    } catch (e) {
        console.error('ERROR DURING CHECK:', e);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

check();

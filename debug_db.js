const knex = require('knex');
const config = require('./knexfile');
const db = knex(config.development);

async function check() {
    try {
        const records = await db('daily_billing_records').orderBy('id', 'desc').limit(5);
        console.log('RECORDS:', JSON.stringify(records, null, 2));

        const machines = await db('Machine').select('MachineID', 'MachineNumber').limit(5);
        console.log('MACHINES:', JSON.stringify(machines, null, 2));

        const masters = await db('MachineMaster').select('MasterID', 'Name').limit(5);
        console.log('MASTERS:', JSON.stringify(masters, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();

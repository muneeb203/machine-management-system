const { db } = require('./src/database/connection');

async function check() {
    try {
        const machines = await db('Machine').distinct('MasterName');
        const masters = await db('MachineMaster').select('Name');
        console.log('--- Machines MasterNames ---');
        console.log(JSON.stringify(machines, null, 2));
        console.log('--- Masters Names ---');
        console.log(JSON.stringify(masters, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

check();

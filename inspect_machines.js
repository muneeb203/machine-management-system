const knex = require('knex');
const config = require('./knexfile');

const db = knex(config.development);

async function checkMachines() {
    try {
        const machines = await db('Machine').select('MachineID', 'MachineNumber', 'MasterName');
        console.log(`Found ${machines.length} machines.`);
        console.log(JSON.stringify(machines.slice(0, 5), null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        db.destroy();
    }
}

checkMachines();

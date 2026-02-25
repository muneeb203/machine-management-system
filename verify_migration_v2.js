const knex = require('knex');
const config = require('./knexfile');

console.log("Starting verification...");

const db = knex(config.development);

async function verify() {
    try {
        console.log("Checking table...");
        const hasTable = await db.schema.hasTable('ContractItemMachine');
        console.log('ContractItemMachine exists:', hasTable);

        console.log("Checking column...");
        const hasCol = await db.schema.hasColumn('ContractItem', 'MachineID');
        console.log('ContractItem.MachineID exists:', hasCol);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        console.log("Done.");
        db.destroy();
    }
}

verify();

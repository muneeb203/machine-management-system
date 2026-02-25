const knex = require('knex');
const config = require('./knexfile');

const db = knex(config.development);

async function verify() {
    try {
        const hasTable = await db.schema.hasTable('ContractItemMachine');
        console.log('ContractItemMachine exists:', hasTable);

        const hasCol = await db.schema.hasColumn('ContractItem', 'MachineID');
        console.log('ContractItem.MachineID exists:', hasCol);
    } catch (e) {
        console.error(e);
    } finally {
        db.destroy();
    }
}

verify();

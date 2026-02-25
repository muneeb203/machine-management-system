const knex = require('knex');
const config = require('./knexfile');
const db = knex(config.development);

async function check() {
    try {
        const history = await db('daily_billing_records')
            .join('Machine', 'daily_billing_records.machine_id', 'Machine.MachineID')
            .join('MachineMaster', 'daily_billing_records.master_id', 'MachineMaster.MasterID')
            .leftJoin('Contract', 'daily_billing_records.contract_id', 'Contract.ContractID')
            .select(
                'daily_billing_records.*',
                'Machine.MachineNumber',
                'MachineMaster.Name as masterName',
                'Contract.ContractNo as contractNumber'
            );

        console.log('HISTORY JOIN RESULT:', JSON.stringify(history, null, 2));

        const machine = await db('Machine').where('MachineID', 1).first();
        console.log('MACHINE 1:', JSON.stringify(machine, null, 2));

        const master = await db('MachineMaster').where('MasterID', 4).first();
        console.log('MASTER 4:', JSON.stringify(master, null, 2));

        process.exit(0);
    } catch (e) {
        console.error('ERROR DURING JOIN:', e);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

check();

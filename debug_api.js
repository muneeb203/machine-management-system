const knex = require('knex');
const config = require('./knexfile');
const db = knex(config.development);

async function check() {
    try {
        const limit = 50;
        const history = await db('daily_billing_records')
            .join('Machine', 'daily_billing_records.machine_id', 'Machine.MachineID')
            .join('MachineMaster', 'daily_billing_records.master_id', 'MachineMaster.MasterID')
            .leftJoin('Contract', 'daily_billing_records.contract_id', 'Contract.ContractID')
            .select(
                'daily_billing_records.*',
                'Machine.MachineNumber',
                'MachineMaster.Name as masterName',
                'Contract.ContractNo as contractNumber',
                'Contract.PONumber as poNumber'
            )
            .orderBy('daily_billing_records.billing_date', 'desc')
            .orderBy('daily_billing_records.created_at', 'desc')
            .limit(limit);

        const historyWithStitches = await Promise.all(history.map(async (record) => {
            const shifts = await db('daily_billing_shift_records')
                .where('billing_record_id', record.id)
                .select('shift', 'stitches_done', 'design_no');

            const dayStitches = shifts
                .filter(s => s.shift === 'day')
                .reduce((sum, s) => sum + s.stitches_done, 0);

            const nightStitches = shifts
                .filter(s => s.shift === 'night')
                .reduce((sum, s) => sum + s.stitches_done, 0);

            const designNos = Array.from(new Set(shifts.map(s => s.design_no))).join(', ');

            return {
                ...record,
                dayStitches,
                nightStitches,
                totalStitches: dayStitches + nightStitches,
                designNos
            };
        }));

        console.log('FINAL API DATA:', JSON.stringify({ data: historyWithStitches }, null, 2));

        process.exit(0);
    } catch (e) {
        console.error('API SIMULATION ERROR:', e);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

check();

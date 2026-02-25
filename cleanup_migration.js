const knex = require('knex');
const config = require('./knexfile');

async function clean() {
    const db = knex(config.development);
    try {
        console.log('Dropping contract_id column from daily_billing_records...');
        await db.raw('ALTER TABLE daily_billing_records DROP COLUMN contract_id');
        console.log('Cleanup successful.');
    } catch (error) {
        if (error.errno === 1091) {
            console.log('Column contract_id already does not exist. (Clean)');
        } else {
            console.error('Cleanup failed:', error);
        }
    } finally {
        await db.destroy();
    }
}

clean();

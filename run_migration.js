const knex = require('knex');
const config = require('./knexfile');

async function migrate() {
    const db = knex(config.development);
    try {
        console.log('Running migrations...');
        const [batchNo, log] = await db.migrate.latest();
        if (log.length === 0) {
            console.log('Already up to date');
        } else {
            console.log(`Batch ${batchNo} run: ${log.length} migrations`);
            console.log(log.join('\n'));
        }
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await db.destroy();
    }
}

migrate();

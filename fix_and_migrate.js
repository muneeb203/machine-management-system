const knex = require('knex');
const config = require('./knexfile');

async function fix() {
    const db = knex(config.development);
    try {
        const migrationName = '20260203000001_create_optimized_billing_tables.js';
        const exists = await db('knex_migrations').where('name', migrationName).first();
        if (!exists) {
            await db('knex_migrations').insert({
                name: migrationName,
                batch: 1,
                migration_time: new Date()
            });
            console.log('Marked 20260203 migration as completed');
        } else {
            console.log('20260203 migration already marked as completed');
        }

        console.log('Running latest migrations...');
        const [batchNo, log] = await db.migrate.latest();
        if (log.length === 0) {
            console.log('Already up to date');
        } else {
            console.log(`Batch ${batchNo} run: ${log.length} migrations`);
            console.log(log.join('\n'));
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.destroy();
    }
}

fix();

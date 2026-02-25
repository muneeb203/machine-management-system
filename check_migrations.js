const knex = require('knex');
const config = require('./knexfile');

async function check() {
    const db = knex(config.development);
    try {
        const migrations = await db('knex_migrations').select('*');
        console.log('--- Applied Migrations ---');
        console.table(migrations);

        // Check if tables exist
        const [tables] = await db.raw('SHOW TABLES');
        console.log('--- Tables Found ---');
        console.log(tables.map(t => Object.values(t)[0]));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.destroy();
    }
}

check();

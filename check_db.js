const knex = require('knex');
const config = require('./knexfile');

async function check() {
    const db = knex(config.development);
    try {
        console.log('Connecting to database...');
        const tables = await db.raw('SHOW TABLES');
        console.log('Tables in database:', JSON.stringify(tables[0], null, 2));
    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await db.destroy();
    }
}

check();

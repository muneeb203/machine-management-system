// Check database tables
require('dotenv').config();
const knex = require('knex');

const db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'embroidery_erp',
    }
});

async function checkTables() {
    try {
        const result = await db.raw("SHOW TABLES LIKE 'bill%'");
        console.log('Tables matching bill%:', result[0]);
        await db.destroy();
    } catch (error) {
        console.error('Error:', error.message);
        await db.destroy();
    }
}

checkTables();

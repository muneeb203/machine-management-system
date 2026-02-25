const knex = require('knex');
require('dotenv').config();

const db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    }
});

async function test() {
    console.log('Testing connection...');
    const result = await db.raw('SELECT 1+1 AS result');
    console.log('Result:', result[0][0]);
    await db.destroy();
    console.log('Done.');
}

test().catch(console.error);

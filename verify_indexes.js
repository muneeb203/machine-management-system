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

async function verify() {
    const tables = [
        'ProductionEntry',
        'daily_production_master',
        'Contract',
        'GatePass',
        'ClippingItem'
    ];

    console.log('--- SHOW INDEX RESULTS ---');
    for (const table of tables) {
        try {
            const results = await db.raw(`SHOW INDEX FROM ${table}`);
            console.log(`\nTable: ${table}`);
            const indexes = results[0].map(i => i.Key_name);
            const uniqueIndexes = [...new Set(indexes)];
            uniqueIndexes.forEach(idx => console.log(` - ${idx}`));
        } catch (e) {
            console.log(`Error reading table ${table}: ${e.message}`);
        }
    }

    console.log('\n--- EXPLAIN QUERY EXAMPLES ---');

    try {
        console.log('\n1. Production Date Range (ProductionEntry):');
        const exp1 = await db.raw(`EXPLAIN SELECT * FROM ProductionEntry WHERE ProductionDate = '2026-01-20'`);
        console.log(JSON.stringify(exp1[0], null, 2));

        console.log('\n2. Contract Status Filter (Contract):');
        const exp2 = await db.raw(`EXPLAIN SELECT * FROM Contract WHERE status = 'active' AND is_temp = 0`);
        console.log(JSON.stringify(exp2[0], null, 2));
    } catch (e) {
        console.log(`Error in EXPLAIN: ${e.message}`);
    }

    await db.destroy();
    console.log('\n--- DONE ---');
}

verify().catch(console.error);

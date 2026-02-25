const { db } = require('./src/database/connection');

async function check() {
    try {
        const columns = await db.raw("PRAGMA table_info(ContractItem)");
        console.log('--- ContractItem Columns ---');
        console.log(columns);

        // Also check MySQL style if likely
        const columnsMysql = await db.raw("SHOW COLUMNS FROM ContractItem");
        console.log('--- MySQL Columns ---');
        console.log(columnsMysql[0]);

    } catch (err) {
        console.log('Error checking columns: ' + err.message);
    } finally {
        process.exit(0);
    }
}

check();

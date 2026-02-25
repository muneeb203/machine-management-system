
export { };
const { db } = require('../database/connection');

async function dropTable() {
    try {
        console.log('Dropping ProductionEntry table if it exists...');
        await db.schema.dropTableIfExists('ProductionEntry');
        console.log('Table dropped successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error dropping table:', error);
        process.exit(1);
    }
}

dropTable();


export { };
const { db } = require('../database/connection');

async function fixTables() {
    try {
        console.log('Dropping GatePassItem table if it exists...');
        await db.schema.dropTableIfExists('GatePassItem');

        console.log('Dropping GatePass table if it exists...');
        await db.schema.dropTableIfExists('GatePass');

        console.log('Tables dropped successfully. You can now run "npm run migrate".');
        process.exit(0);
    } catch (error) {
        console.error('Error dropping tables:', error);
        process.exit(1);
    }
}

fixTables();

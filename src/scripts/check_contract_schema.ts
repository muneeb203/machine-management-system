
const { db } = require('../database/connection');

async function checkSchema() {
    try {
        const result = await db.raw('SHOW CREATE TABLE Contract');
        console.log(JSON.stringify(result[0], null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();

export { };

const { db } = require('./src/database/connection');

async function check() {
    try {
        const item = await db('ContractItem').first();
        console.log('--- First ContractItem Row ---');
        console.log(JSON.stringify(item, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

check();

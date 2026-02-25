const knexConfig = require('../../knexfile');
const knex = require('knex')(knexConfig.development);

async function checkColumns() {
    try {
        const columns = await knex('ContractItem').columnInfo();
        console.log('Columns in ContractItem:', Object.keys(columns));
    } catch (error) {
        console.error('Error checking columns:', error);
    } finally {
        await knex.destroy();
    }
}

checkColumns();

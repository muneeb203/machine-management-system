require('dotenv').config();
const knex = require('knex');
const config = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

async function checkColumns() {
    try {
        const columns = await db('Contract').columnInfo();
        console.log('Columns in Contract table:', Object.keys(columns));
        process.exit(0);
    } catch (error) {
        console.error('Error checking columns:', error);
        process.exit(1);
    }
}

checkColumns();

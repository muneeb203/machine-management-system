
const mysql = require('mysql2/promise');
require('dotenv').config();

async function forceBackup() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('Forcing migration on DB:', process.env.DB_NAME);

    try {
        // 1. Status
        try {
            console.log('Attempting to ADD status column...');
            await connection.execute(`
            ALTER TABLE Contract 
            ADD COLUMN status ENUM('draft', 'active', 'completed', 'cancelled') DEFAULT 'active'
        `);
            console.log('SUCCESS: status column added.');
        } catch (err) {
            console.log('INFO: status column add failed (likely exists):', err.code, err.message);
        }

        // 2. Last Updated
        try {
            console.log('Attempting to ADD last_updated_at column...');
            await connection.execute(`
            ALTER TABLE Contract
            ADD COLUMN last_updated_at DATETIME DEFAULT NULL
        `);
            console.log('SUCCESS: last_updated_at column added.');
        } catch (err) {
            console.log('INFO: last_updated_at column add failed (likely exists):', err.code, err.message);
        }

    } finally {
        await connection.end();
    }
}

forceBackup();

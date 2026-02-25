
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Checking Contract table schema...');

        // Check if columns exist
        const [columns] = await connection.execute("SHOW COLUMNS FROM Contract");
        const hasStatus = columns.some(c => c.Field === 'status');
        const hasLastUpdated = columns.some(c => c.Field === 'last_updated_at');

        if (!hasStatus) {
            console.log('Adding status column...');
            // Note: We use lowercase 'status' to match the plan, but DB often capitalizes. 
            // We'll stick to 'status' as column name.
            await connection.execute(`
        ALTER TABLE Contract 
        ADD COLUMN status ENUM('draft', 'active', 'completed', 'cancelled') DEFAULT 'active'
      `);
            console.log('Status column added.');
        } else {
            console.log('Status column already exists.');
        }

        if (!hasLastUpdated) {
            console.log('Adding last_updated_at column...');
            await connection.execute(`
            ALTER TABLE Contract
            ADD COLUMN last_updated_at DATETIME DEFAULT NULL
        `);
            console.log('last_updated_at column added.');
        } else {
            console.log('last_updated_at column already exists.');
        }

        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();

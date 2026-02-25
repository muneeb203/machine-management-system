
const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnose() {
    console.log('--- DB DIAGNOSTIC START ---');
    console.log(`Host: ${process.env.DB_HOST}, User: ${process.env.DB_USER}, DB: ${process.env.DB_NAME}`);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // 1. List Tables
        console.log('\n[1] listing tables...');
        const [tables] = await connection.execute("SHOW TABLES");
        console.log('Tables found:', tables.map(t => Object.values(t)[0]).join(', '));

        // 2. Describe Contract
        console.log('\n[2] Describing Contract table...');
        try {
            const [columns] = await connection.execute("SHOW COLUMNS FROM Contract");
            console.log('Columns:');
            columns.forEach(c => console.log(`  - ${c.Field} (${c.Type})`));
        } catch (e) {
            console.log('Error describing Contract:', e.message);
        }

        // 3. Force Add Status (again, verbose)
        console.log('\n[3] Attempting ADD COLUMN status (active defaults)...');
        try {
            await connection.execute("ALTER TABLE Contract ADD COLUMN status ENUM('draft', 'active', 'completed', 'cancelled') DEFAULT 'active'");
            console.log('>>> SUCCESS: Column added!');
        } catch (e) {
            console.log('>>> INFO: Add failed:', e.message);
        }

        // 4. Force Add last_updated_at
        console.log('\n[4] Attempting ADD COLUMN last_updated_at...');
        try {
            await connection.execute("ALTER TABLE Contract ADD COLUMN last_updated_at DATETIME DEFAULT NULL");
            console.log('>>> SUCCESS: Column added!');
        } catch (e) {
            console.log('>>> INFO: Add failed:', e.message);
        }

        console.log('--- DB DIAGNOSTIC END ---');

    } catch (err) {
        console.error('FATAL:', err);
    } finally {
        await connection.end();
    }
}

diagnose();

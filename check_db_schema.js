
const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    console.log('--- CHECK DB SCHEMA ---');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Port: ${process.env.DB_PORT}`);
    console.log(`User: ${process.env.DB_USER}`);
    console.log(`DB: ${process.env.DB_NAME}`);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute("SHOW COLUMNS FROM Contract");
        console.log('COLUMNS FOUND:', rows.map(r => r.Field).join(', '));

        // Explicit check
        if (rows.find(r => r.Field === 'status')) {
            console.log('>>> STATUS COLUMN EXISTS');
        } else {
            console.log('>>> STATUS COLUMN MISSING');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await connection.end();
    }
}

check();

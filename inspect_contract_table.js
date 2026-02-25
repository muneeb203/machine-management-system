
const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspect() {
    console.log('Connecting to database:', process.env.DB_NAME);
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute("SHOW COLUMNS FROM Contract");
        console.log('Columns in Contract table:');
        rows.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

inspect();

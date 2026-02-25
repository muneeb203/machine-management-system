const mysql = require('mysql2/promise');
require('dotenv').config();
console.log('Script started...');
console.log('DB Config:', { host: process.env.DB_HOST, user: process.env.DB_USER, db: process.env.DB_NAME });


async function checkSchema() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        console.log('Connected to database:', process.env.DB_NAME);

        const [rows] = await connection.execute('DESCRIBE Contract');

        console.log('Contract Table Schema:');
        rows.forEach(row => {
            if (row.Field === 'ContractNo') {
                console.log(`*** ${row.Field} type: ${row.Type} ***`);
            } else {
                console.log(`${row.Field}: ${row.Type}`);
            }
        });

        await connection.end();
    } catch (err) {
        console.error('Error checking schema:', err);
    }
}

checkSchema();

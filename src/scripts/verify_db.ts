import dotenv from 'dotenv';
import knex from 'knex';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    }
};

console.log('--- Testing MySQL Connection ---');
console.log('Host:', config.connection.host);
console.log('User:', config.connection.user);
console.log('Database:', config.connection.database);
console.log('Port:', config.connection.port);

const db = knex(config);

db.raw('SELECT 1+1 as result')
    .then(() => {
        console.log('✅ Connection Successful!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Connection Failed:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('   -> Check if MySQL is running and Port is correct.');
        }
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('   -> Check User/Password.');
        }
        if (err.code === 'ER_BAD_DB_ERROR') {
            console.error('   -> Database name does not exist. Create it.');
        }
        process.exit(1);
    });

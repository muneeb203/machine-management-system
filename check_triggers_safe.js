const mysql = require('mysql2/promise');

async function check() {
    try {
        const connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: '1234',
            database: 'embroidery_erp'
        });

        const [triggers] = await connection.query('SHOW TRIGGERS');
        console.log('TRIGGERS found:', triggers.length);
        triggers.forEach(t => {
            console.log(`Trigger: ${t.Trigger}, Table: ${t.Table}, Event: ${t.Event}, Timing: ${t.Timing}`);
            console.log(`Statement:\n${t.Statement}\n`);
        });
        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();

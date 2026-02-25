const knex = require('knex');
const config = require('./src/config').config;

const db = knex({
    client: 'mysql2',
    connection: {
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.name
    }
});

async function check() {
    try {
        const [triggers] = await db.raw('SHOW TRIGGERS');
        console.log('TRIGGERS found:', triggers.length);
        triggers.forEach(t => {
            console.log(`Trigger: ${t.Trigger}, Table: ${t.Table}, Event: ${t.Event}, Timing: ${t.Timing}`);
            console.log(`Statement:\n${t.Statement}\n`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();

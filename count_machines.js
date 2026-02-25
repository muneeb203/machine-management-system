const knex = require('knex');
const config = require('./knexfile');

const db = knex(config.development);

db('Machine').count('MachineID as count').first()
    .then(res => {
        console.log("Count:", res.count);
        return db('Machine').select('MasterName').limit(5);
    })
    .then(rows => {
        console.log("Rows:", JSON.stringify(rows));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

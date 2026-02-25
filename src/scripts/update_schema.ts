import { db } from '../database/connection';

async function updateSchema() {
    console.log('Starting schema update for Postgres...');

    try {
        // Check if tables allow standard drop logic, or just try to drop.
        // Use quotes to enforce PascalCase if we want to match valid Knex query db('Contract')

        console.log('Dropping old table "ContractItem"...');
        await db.schema.raw('DROP TABLE IF EXISTS "ContractItem" CASCADE');

        console.log('Dropping old table "Contract"...');
        await db.schema.raw('DROP TABLE IF EXISTS "Contract" CASCADE');

        console.log('Creating table "Contract"...');
        await db.schema.createTable('Contract', (table) => {
            // Enforce specific column names using quotes? 
            // Knex .increments('ContractID') usually produces "ContractID" serial ...
            // Let's use specificType for exact control or use standard knex builders
            table.increments('ContractID').primary();
            // ContractNo as generated column
            table.specificType('ContractNo', 'INT GENERATED ALWAYS AS ("ContractID" + 999) STORED').unique().notNullable();
            table.date('ContractDate').notNullable();
            table.string('PONumber', 50).notNullable();
        });

        console.log('Creating table "ContractItem"...');
        await db.schema.createTable('ContractItem', (table) => {
            table.increments('ContractItemID').primary();

            // Foreign key
            table.integer('ContractID').notNullable();
            table.foreign('ContractID').references('Contract.ContractID').onDelete('CASCADE');

            table.integer('H2H_OGP').nullable();
            table.integer('WTE_IGP').nullable();
            table.string('ItemDescription', 255).notNullable();
            table.string('Fabric', 100).notNullable();
            table.string('Color', 50).notNullable();
            table.decimal('Repeat', 10, 2).notNullable();
            table.integer('Pieces').notNullable();
            table.decimal('Yard', 10, 2).notNullable();
        });

        console.log('Schema update completed successfully.');
    } catch (error) {
        console.error('Schema update failed:', error);
    } finally {
        await db.destroy();
    }
}

updateSchema();

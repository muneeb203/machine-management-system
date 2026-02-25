/**
 * Migration: Create billing tables
 * Creates bill and bill_item tables for Daily Billing Record feature
 */

exports.up = async function (knex) {
    const hasBill = await knex.schema.hasTable('bill');
    if (!hasBill) {
        await knex.schema.createTable('bill', (table) => {
            table.increments('bill_id').primary();
            table.string('bill_number', 50).notNullable().unique();
            table.date('bill_date').notNullable();
            table.string('party_name', 255).notNullable();
            table.string('po_number', 100).nullable();
            table.integer('contract_id').unsigned().nullable();
            table.integer('created_by').unsigned().nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());

            // Foreign key to Contract table
            table.foreign('contract_id').references('ContractID').inTable('Contract').onDelete('SET NULL');

            // Indexes for performance
            table.index('bill_number');
            table.index('bill_date');
            table.index('party_name');
        });
    }

    const hasBillItem = await knex.schema.hasTable('bill_item');
    if (!hasBillItem) {
        await knex.schema.createTable('bill_item', (table) => {
            table.increments('bill_item_id').primary();
            table.integer('bill_id').unsigned().notNullable();
            table.string('design_no', 100).nullable();
            table.string('item_description', 255).nullable();
            table.decimal('qty', 14, 2).defaultTo(0);
            table.decimal('stitches', 18, 2).defaultTo(0);
            table.decimal('rate_per_unit', 18, 6).defaultTo(0);
            table.enu('rate_type', ['HDS', 'SHEET', 'FUSING']).notNullable();
            table.decimal('amount', 18, 2).notNullable();
            table.json('formula_details').nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());

            // Foreign key to bill table with cascade delete
            table.foreign('bill_id').references('bill_id').inTable('bill').onDelete('CASCADE');

            // Index for performance
            table.index('bill_id');
        });
    }
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('bill_item')
        .dropTableIfExists('bill');
};

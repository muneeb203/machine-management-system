/**
 * Create GatePass and GatePassItem tables.
 * Replaces any existing gate_passes table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // Drop old table if it exists to ensure clean state with new schema
    await knex.schema.dropTableIfExists('inventory_movements'); // Derived table from old schema
    await knex.schema.dropTableIfExists('gate_passes'); // Old table name

    // Create new GatePass table
    await knex.schema.createTable('GatePass', function (table) {
        table.increments('GatePassID').primary();
        table.string('PassNumber', 50).notNullable().unique();
        table.enum('Type', ['Inward', 'Outward']).notNullable(); // 'Inward' or 'Outward'
        table.datetime('PassDate').notNullable();
        table.integer('ContractID').nullable().references('ContractID').inTable('Contract').onDelete('SET NULL');

        // Carrier / External Details
        table.string('CarrierName', 100).nullable();
        table.string('VehicleNumber', 50).nullable();
        table.string('DriverName', 100).nullable();

        table.string('Status', 20).defaultTo('Draft'); // Draft, Approved, Completed
        table.text('Remarks').nullable();

        // Audit
        table.integer('CreatedBy').nullable(); // User ID
        table.timestamps(true, true);
    });

    // Create GatePassItem table for line items
    await knex.schema.createTable('GatePassItem', function (table) {
        table.increments('ItemID').primary();
        table.integer('GatePassID').notNullable().unsigned().references('GatePassID').inTable('GatePass').onDelete('CASCADE');

        table.string('ItemType', 50).nullable(); // e.g., 'Fabric', 'Thread', 'Finished Goods'
        table.string('Description', 255).notNullable();
        table.decimal('Quantity', 10, 2).notNullable().defaultTo(0);
        table.string('Unit', 20).nullable(); // e.g., 'kg', 'm', 'pcs'

        table.timestamps(true, true);
    });
};

/**
 * Drop GatePass tables.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('GatePassItem');
    await knex.schema.dropTableIfExists('GatePass');
};

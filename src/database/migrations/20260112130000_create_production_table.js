/**
 * Create ProductionEntry table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('ProductionEntry', function (table) {
        table.increments('ProductionID').primary();
        table.integer('MachineID').unsigned().notNullable().references('MachineID').inTable('Machine');
        // Linking to ContractItem which links to Contract
        table.integer('ContractItemID').notNullable().references('ContractItemID').inTable('ContractItem');
        table.date('ProductionDate').notNullable();
        table.string('Shift', 10).notNullable(); // 'Day', 'Night'
        table.integer('Stitches').notNullable();
        table.integer('Repeats').nullable();
        table.string('OperatorName', 100).nullable();
        table.text('Notes').nullable();
        table.timestamps(true, true);
    });
};

/**
 * Drop ProductionEntry table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('ProductionEntry');
};

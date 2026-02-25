/**
 * Create Machine table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('Machine', function (table) {
        table.increments('MachineID').primary();
        table.integer('MachineNumber').notNullable().unique();
        table.string('MasterName', 100).notNullable();
        table.string('Status', 20).notNullable().defaultTo('idle');
        table.boolean('IsActive').notNullable().defaultTo(true);
        table.timestamps(true, true); // CreatedAt, UpdatedAt
    });
};

/**
 * Drop Machine table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('Machine');
};

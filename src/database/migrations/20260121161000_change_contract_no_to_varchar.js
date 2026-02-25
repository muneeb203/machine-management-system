/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('Contract', function (table) {
        // Change ContractNo from INT to VARCHAR(50) to support alphanumeric values
        table.string('ContractNo', 50).notNullable().alter();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('Contract', function (table) {
        // Revert back to integer (Note: This might fail if non-numeric data exists)
        table.integer('ContractNo').notNullable().alter();
    });
};

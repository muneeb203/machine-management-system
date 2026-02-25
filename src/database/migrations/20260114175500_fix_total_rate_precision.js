
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('ContractItem', function (table) {
        table.decimal('Total_Rate', 18, 4).alter();
        table.decimal('Rate_per_Repeat', 18, 4).alter(); // Increase this too just in case
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('ContractItem', function (table) {
        // Reverting to previous small size (risky if data exists, but strict down migration)
        table.decimal('Total_Rate', 10, 4).alter();
        table.decimal('Rate_per_Repeat', 14, 4).alter(); // Revert to defined size in prev migration
    });
};

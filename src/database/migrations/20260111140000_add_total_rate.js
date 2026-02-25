/**
 * Add 'Total_Rate' column to ContractItem table.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.decimal('Total_Rate', 10, 4).nullable();
    });
};

/**
 * Drop 'Total_Rate' column if rolled back.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.dropColumn('Total_Rate');
    });
};

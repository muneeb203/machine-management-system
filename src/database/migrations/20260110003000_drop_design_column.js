/**
 * Drop 'Design' column from ContractItem table as it is being removed.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.dropColumn('Design');
    });
};

/**
 * Restore 'Design' column if rolled back.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.string('Design', 255).nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('ContractItemMachine', function (table) {
        table.renameColumn('avg_days_required', 'avg_stitches_per_day');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('ContractItemMachine', function (table) {
        table.renameColumn('avg_stitches_per_day', 'avg_days_required');
    });
};

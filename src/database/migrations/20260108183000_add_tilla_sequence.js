/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.integer('Tilla').defaultTo(0);
        table.integer('Sequence').defaultTo(0);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.dropColumn('Tilla');
        table.dropColumn('Sequence');
    });
};

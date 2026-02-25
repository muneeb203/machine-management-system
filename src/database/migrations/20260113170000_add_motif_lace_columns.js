/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.integer('Motif').nullable().defaultTo(0);
        table.integer('Lace').nullable().defaultTo(0);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.dropColumn('Motif');
        table.dropColumn('Lace');
    });
};

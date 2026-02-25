/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('Contract', function (table) {
        table.boolean('IsActive').defaultTo(1).notNullable();
        table.string('Progress').defaultTo('Active').notNullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('Contract', function (table) {
        table.dropColumn('IsActive');
        table.dropColumn('Progress');
    });
};

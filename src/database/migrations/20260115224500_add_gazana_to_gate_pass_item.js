/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.decimal('Gazana', 10, 2).defaultTo(0).nullable(); // Gazana field
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.dropColumn('Gazana');
    });
};

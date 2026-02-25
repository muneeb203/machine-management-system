/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.renameColumn('Gazana', 'Yards');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.renameColumn('Yards', 'Gazana');
    });
};
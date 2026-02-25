/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.string('Repeat').nullable();
        table.string('ItemRemarks').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.dropColumn('Repeat');
        table.dropColumn('ItemRemarks');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.string('Collection').nullable();
        table.string('DesignNo').nullable();
        table.string('Component').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('GatePassItem', function (table) {
        table.dropColumn('Collection');
        table.dropColumn('DesignNo');
        table.dropColumn('Component');
    });
};

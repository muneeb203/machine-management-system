
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.string('MachineGazz').nullable();
        table.string('MachineHead').nullable();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.dropColumn('MachineGazz');
        table.dropColumn('MachineHead');
    });
};

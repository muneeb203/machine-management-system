/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.string('Design', 255).nullable();
        table.string('Collection', 255).nullable();
        table.string('DesignNo', 100).nullable();
        table.string('Component', 100).nullable();
        table.string('Stitch', 100).nullable();
        table.decimal('Rate', 12, 2).nullable().defaultTo(0);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('ContractItem', function (table) {
        table.dropColumn('Design');
        table.dropColumn('Collection');
        table.dropColumn('DesignNo');
        table.dropColumn('Component');
        table.dropColumn('Stitch');
        table.dropColumn('Rate');
    });
};

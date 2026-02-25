/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('ContractItem', function (table) {
        table.string('Tilla').alter();
        table.string('Sequence').alter();
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('ContractItem', function (table) {
        // Reverting to integer might fail if text data exists, but strict down migration logic implies return to prev state.
        // We will attempt it, but in practice, down migrations for type looseness are tricky.
        table.integer('Tilla').alter();
        table.integer('Sequence').alter();
    });
};

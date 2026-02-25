/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.alterTable('daily_production_master', function (table) {
        table.integer('machine_id').nullable(); // Nullable for existing records, but app will enforce
        // We might want to remove machines_count if it's no longer relevant, 
        // but the user description implied "Incorrectly showing... total number".
        // I'll keep it for now or assume it's legacy/metadata.
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.alterTable('daily_production_master', function (table) {
        table.dropColumn('machine_id');
    });
};

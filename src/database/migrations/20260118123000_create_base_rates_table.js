/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('base_rates', function (table) {
        table.increments('id').primary();
        table.decimal('rate_per_stitch', 10, 6).notNullable();
        table.date('effective_from').notNullable();
        table.date('effective_to').nullable();
        table.boolean('is_active').defaultTo(true);
        table.integer('created_by').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
    }).then(function () {
        // Seed default rate
        return knex('base_rates').insert({
            rate_per_stitch: 0.05, // Default assumption
            effective_from: knex.fn.now(),
            is_active: true
        });
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('base_rates');
};

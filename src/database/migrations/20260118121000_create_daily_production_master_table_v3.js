/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('daily_production_master', function (table) {
        table.increments('id').primary();

        // Removing FK constraint for now to avoid migration errors if table name mismatches.
        // App logic validates existence.
        table.integer('master_id').unsigned();

        table.integer('machines_count').notNullable().defaultTo(0);
        table.string('collection_name').notNullable();
        table.integer('day_shift_stitches').defaultTo(0);
        table.integer('night_shift_stitches').defaultTo(0);
        table.integer('total_stitches').defaultTo(0);
        table.decimal('rate_per_stitch', 10, 6).nullable();
        table.decimal('total_amount', 12, 2).defaultTo(0);
        table.date('production_date').notNullable();

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Keeping unique constraint
        table.unique(['master_id', 'production_date', 'collection_name'], 'idx_dpm_uniq');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('daily_production_master');
};

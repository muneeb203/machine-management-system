
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('audit_logs', function (table) {
        table.increments('id');
        table.string('action').notNullable();
        table.string('table_name');
        table.string('record_id');
        table.text('old_values'); // Using text for JSON/serialized data
        table.text('new_values');
        table.integer('user_id');
        table.string('ip_address');
        table.string('user_agent');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('audit_logs');
};

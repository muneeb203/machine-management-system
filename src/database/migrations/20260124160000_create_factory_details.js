/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('factory_details');
    if (!exists) {
        await knex.schema.createTable('factory_details', function (table) {
            table.increments('id').primary();
            table.string('factory_name', 255).notNullable();
            table.text('address').nullable();
            table.string('phone', 50).nullable();
            table.string('email', 100).nullable();
            table.string('tax_registration', 100).nullable();
            table.string('website', 200).nullable();
            table.string('logo_url', 1024).nullable();
            table.string('footer_text', 255).nullable();
            table.boolean('is_active').notNullable().defaultTo(true);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        });

        // Insert Default
        await knex('factory_details').insert({
            factory_name: 'Your Factory Name',
            is_active: 1
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('factory_details');
};

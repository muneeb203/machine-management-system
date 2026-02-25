/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('MachineMaster', function (table) {
        table.increments('MasterID').primary();
        table.string('Name').notNullable();
        table.integer('Age').notNullable();
        table.string('ContactNumber').notNullable();
        table.string('CNIC').notNullable().unique();
        table.string('Status').defaultTo('Active'); // 'Active', 'Inactive'
        table.timestamp('CreatedAt').defaultTo(knex.fn.now());
        table.timestamp('UpdatedAt').defaultTo(knex.fn.now());
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('MachineMaster');
};

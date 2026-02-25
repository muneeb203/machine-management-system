/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Increase precision for avg_stitches_per_day so values like 2500 fit
  await knex.schema.alterTable('ContractItemMachine', function (table) {
    table.decimal('avg_stitches_per_day', 14, 2).notNullable().defaultTo(0).alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Revert to the previous smaller precision (5,2)
  await knex.schema.alterTable('ContractItemMachine', function (table) {
    table.decimal('avg_stitches_per_day', 5, 2).notNullable().defaultTo(0).alter();
  });
};


/**
 * Migration: Add Yards field to ContractItem table
 */

exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('ContractItem');
  if (!hasTable) {
    console.log('ContractItem table does not exist, skipping migration');
    return;
  }

  // Add Yards column
  await knex.schema.alterTable('ContractItem', (table) => {
    table.decimal('Yards', 10, 2).nullable().comment('Yards quantity');
  });

  console.log('✓ Added Yards column to ContractItem table');
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('ContractItem');
  if (!hasTable) {
    return;
  }

  await knex.schema.alterTable('ContractItem', (table) => {
    table.dropColumn('Yards');
  });

  console.log('✓ Removed Yards column from ContractItem table');
};

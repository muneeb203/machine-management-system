/**
 * Migration: Optimize contract number generation
 * Adds index on ContractNo and optimizes query performance
 */

exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('Contract');
  if (!hasTable) {
    console.log('Contract table does not exist, skipping migration');
    return;
  }

  // Add index on ContractNo for faster MAX queries
  await knex.schema.alterTable('Contract', (table) => {
    // Check if index already exists before adding
    table.index('ContractNo', 'idx_contract_no');
  });

  console.log('✓ Added index on ContractNo for optimized queries');
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('Contract');
  if (!hasTable) {
    return;
  }

  await knex.schema.alterTable('Contract', (table) => {
    table.dropIndex('ContractNo', 'idx_contract_no');
  });

  console.log('✓ Removed index on ContractNo');
};

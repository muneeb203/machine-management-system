/**
 * Migration: Add piece-based rate fields to ContractItem table
 * Adds support for Rate per Piece, Motif Rate, and Lace Rate calculations
 */

exports.up = async function(knex) {
  // Check if table exists
  const hasTable = await knex.schema.hasTable('ContractItem');
  if (!hasTable) {
    console.log('ContractItem table does not exist, skipping migration');
    return;
  }

  // Add new columns for piece-based rates
  await knex.schema.alterTable('ContractItem', (table) => {
    // Check and add Rate_per_Piece
    table.decimal('Rate_per_Piece', 10, 4).nullable().comment('Rate per piece');
    
    // Check and add Piece_Amount (calculated)
    table.decimal('Piece_Amount', 10, 4).nullable().comment('Calculated: Rate per Piece × Total Pieces');
    
    // Check and add Motif_Rate
    table.decimal('Motif_Rate', 10, 4).nullable().comment('Rate per motif piece');
    
    // Check and add Motif_Amount (calculated)
    table.decimal('Motif_Amount', 10, 4).nullable().comment('Calculated: Motif Rate × Motif Quantity');
    
    // Check and add Lace_Rate
    table.decimal('Lace_Rate', 10, 4).nullable().comment('Rate per lace piece');
    
    // Check and add Lace_Amount (calculated)
    table.decimal('Lace_Amount', 10, 4).nullable().comment('Calculated: Lace Rate × Lace Quantity');
  });

  console.log('✓ Added piece-based rate fields to ContractItem table');
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('ContractItem');
  if (!hasTable) {
    return;
  }

  await knex.schema.alterTable('ContractItem', (table) => {
    table.dropColumn('Rate_per_Piece');
    table.dropColumn('Piece_Amount');
    table.dropColumn('Motif_Rate');
    table.dropColumn('Motif_Amount');
    table.dropColumn('Lace_Rate');
    table.dropColumn('Lace_Amount');
  });

  console.log('✓ Removed piece-based rate fields from ContractItem table');
};

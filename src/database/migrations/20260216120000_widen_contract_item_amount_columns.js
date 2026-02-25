/**
 * Migration: Widen ContractItem amount columns to support large values
 * Fixes "Out of range value" errors for Piece_Amount, Rate_per_Piece, etc.
 * DECIMAL(10,4) max ~999,999 - insufficient for high-volume contracts
 */

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('ContractItem');
  if (!hasTable) return;

  const columns = [
    { name: 'Piece_Amount', current: [10, 4], new: [18, 4] },
    { name: 'Rate_per_Piece', current: [10, 4], new: [18, 4] },
    { name: 'Motif_Amount', current: [10, 4], new: [18, 4] },
    { name: 'Motif_Rate', current: [10, 4], new: [18, 4] },
    { name: 'Lace_Amount', current: [10, 4], new: [18, 4] },
    { name: 'Lace_Rate', current: [10, 4], new: [18, 4] },
  ];

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('ContractItem', col.name);
    if (hasCol) {
      await knex.schema.alterTable('ContractItem', (table) => {
        table.decimal(col.name, col.new[0], col.new[1]).alter();
      });
    }
  }

  // Also widen Calculated_Rate if it exists (may be 14,4 from earlier migration)
  const hasCalculatedRate = await knex.schema.hasColumn('ContractItem', 'Calculated_Rate');
  if (hasCalculatedRate) {
    await knex.schema.alterTable('ContractItem', (table) => {
      table.decimal('Calculated_Rate', 18, 4).alter();
    });
  }

  console.log('✓ Widened ContractItem amount columns to DECIMAL(18,4)');
};

exports.down = async function (knex) {
  const hasTable = await knex.schema.hasTable('ContractItem');
  if (!hasTable) return;

  const columns = [
    { name: 'Piece_Amount', revert: [10, 4] },
    { name: 'Rate_per_Piece', revert: [10, 4] },
    { name: 'Motif_Amount', revert: [10, 4] },
    { name: 'Motif_Rate', revert: [10, 4] },
    { name: 'Lace_Amount', revert: [10, 4] },
    { name: 'Lace_Rate', revert: [10, 4] },
  ];

  for (const col of columns) {
    const hasCol = await knex.schema.hasColumn('ContractItem', col.name);
    if (hasCol) {
      await knex.schema.alterTable('ContractItem', (table) => {
        table.decimal(col.name, col.revert[0], col.revert[1]).alter();
      });
    }
  }

  const hasCalculatedRate = await knex.schema.hasColumn('ContractItem', 'Calculated_Rate');
  if (hasCalculatedRate) {
    await knex.schema.alterTable('ContractItem', (table) => {
      table.decimal('Calculated_Rate', 14, 4).alter();
    });
  }

  console.log('✓ Reverted ContractItem amount columns');
};

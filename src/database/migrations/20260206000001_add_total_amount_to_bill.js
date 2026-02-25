/**
 * Add total_amount column to bill table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('bill', 'total_amount');
  
  if (!hasColumn) {
    await knex.schema.table('bill', (table) => {
      table.decimal('total_amount', 10, 2).nullable().comment('Total bill amount');
    });
    console.log('Added total_amount column to bill table');
  } else {
    console.log('total_amount column already exists in bill table');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('bill', 'total_amount');
  
  if (hasColumn) {
    await knex.schema.table('bill', (table) => {
      table.dropColumn('total_amount');
    });
  }
};

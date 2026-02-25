/**
 * Add matrix billing fields to bill_item table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Add columns one by one, checking if they exist first
  const columnsToAdd = [
    { name: 'fabric', type: (table) => table.string('fabric', 50).nullable().comment('Fabric type (ORG, POLY, etc)') },
    { name: 'yards', type: (table) => table.decimal('yards', 10, 2).nullable().comment('Fabric yards/meters') },
    { name: 'rate_stitch', type: (table) => table.decimal('rate_stitch', 10, 4).nullable().comment('Rate per stitch') },
    { name: 'rate_per_yds', type: (table) => table.decimal('rate_per_yds', 10, 2).nullable().comment('Rate per yard/meter') },
    { name: 'rate_repeat', type: (table) => table.decimal('rate_repeat', 10, 2).nullable().comment('Rate per repeat') },
    { name: 'repeats', type: (table) => table.decimal('repeats', 10, 2).nullable().comment('Number of repeats') },
    { name: 'pieces', type: (table) => table.integer('pieces').nullable().comment('Number of pieces') },
    { name: 'wte_ogp', type: (table) => table.string('wte_ogp', 100).nullable().comment('WTE OGP reference') },
    { name: 'h2h_po', type: (table) => table.string('h2h_po', 100).nullable().comment('H2H PO reference') },
    { name: 'formula_details', type: (table) => table.json('formula_details').nullable().comment('Calculation audit trail') }
  ];
  
  for (const column of columnsToAdd) {
    const hasColumn = await knex.schema.hasColumn('bill_item', column.name);
    if (!hasColumn) {
      await knex.schema.table('bill_item', (table) => {
        column.type(table);
      });
      console.log(`Added column: ${column.name}`);
    } else {
      console.log(`Column ${column.name} already exists, skipping`);
    }
  }
  
  console.log('Billing matrix fields migration completed');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const columnsToRemove = [
    'fabric', 'yards', 'rate_stitch', 'rate_per_yds', 'rate_repeat',
    'repeats', 'pieces', 'wte_ogp', 'h2h_po', 'formula_details'
  ];
  
  for (const columnName of columnsToRemove) {
    const hasColumn = await knex.schema.hasColumn('bill_item', columnName);
    if (hasColumn) {
      await knex.schema.table('bill_item', (table) => {
        table.dropColumn(columnName);
      });
    }
  }
};

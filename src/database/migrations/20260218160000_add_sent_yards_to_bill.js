/**
 * Add sent_yards and remaining_yards to bill table (Optimized Billing - Contract Section 2 yards)
 * contract_id already exists on bill table
 */
exports.up = async function(knex) {
  const hasSentYards = await knex.schema.hasColumn('bill', 'sent_yards');
  if (!hasSentYards) {
    await knex.schema.table('bill', (table) => {
      table.decimal('sent_yards', 12, 4).nullable().comment('Yards sent in this bill (from contract Section 2)');
      table.decimal('remaining_yards', 12, 4).nullable().comment('Remaining yards on contract after this bill');
    });
  }
};

exports.down = async function(knex) {
  const hasSentYards = await knex.schema.hasColumn('bill', 'sent_yards');
  if (hasSentYards) {
    await knex.schema.table('bill', (table) => {
      table.dropColumn('sent_yards');
      table.dropColumn('remaining_yards');
    });
  }
};

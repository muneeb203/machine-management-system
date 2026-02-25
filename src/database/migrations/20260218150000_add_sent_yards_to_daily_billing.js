/**
 * Add sent_yards and remaining_yards to daily_billing_records
 * sent_yards: user-entered yards sent for this billing record
 * remaining_yards: contract total yards - cumulative sent (saved after this record)
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('daily_billing_records');
  if (!hasTable) return;

  const hasSentYards = await knex.schema.hasColumn('daily_billing_records', 'sent_yards');
  if (!hasSentYards) {
    await knex.schema.alterTable('daily_billing_records', function (table) {
      table.decimal('sent_yards', 12, 2).nullable().defaultTo(0).comment('Yards sent in this billing record');
    });
  }

  const hasRemainingYards = await knex.schema.hasColumn('daily_billing_records', 'remaining_yards');
  if (!hasRemainingYards) {
    await knex.schema.alterTable('daily_billing_records', function (table) {
      table.decimal('remaining_yards', 12, 2).nullable().comment('Remaining yards for contract after this record');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasTable = await knex.schema.hasTable('daily_billing_records');
  if (!hasTable) return;

  if (await knex.schema.hasColumn('daily_billing_records', 'sent_yards')) {
    await knex.schema.alterTable('daily_billing_records', function (table) {
      table.dropColumn('sent_yards');
    });
  }
  if (await knex.schema.hasColumn('daily_billing_records', 'remaining_yards')) {
    await knex.schema.alterTable('daily_billing_records', function (table) {
      table.dropColumn('remaining_yards');
    });
  }
};

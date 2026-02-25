/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Main daily billing records table (machine-wise)
    .createTable('daily_billing_records', function(table) {
      table.increments('id').primary();
      table.integer('machine_id').unsigned().notNullable();
      table.integer('master_id').unsigned().notNullable();
      table.date('billing_date').notNullable();
      table.decimal('total_amount', 12, 2).notNullable().defaultTo(0);
      table.enum('status', ['draft', 'saved', 'approved']).defaultTo('draft');
      table.integer('created_by').unsigned().notNullable();
      table.integer('approved_by').unsigned().nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('approved_at').nullable();
      
      // Foreign keys
      table.foreign('machine_id').references('MachineID').inTable('Machine');
      table.foreign('master_id').references('MasterID').inTable('MachineMaster');
      table.foreign('created_by').references('id').inTable('users');
      table.foreign('approved_by').references('id').inTable('users');
      
      // Indexes
      table.index(['billing_date', 'machine_id']);
      table.index(['status']);
    })
    
    // Individual shift records for each design
    .createTable('daily_billing_shift_records', function(table) {
      table.increments('id').primary();
      table.integer('billing_record_id').unsigned().notNullable();
      table.string('design_no', 50).notNullable();
      table.integer('d_stitch').notNullable(); // Total stitches for the design
      table.enum('shift', ['day', 'night']).notNullable();
      table.integer('stitches_done').notNullable();
      table.decimal('fabric', 10, 4).notNullable(); // Calculated: (Machine Gazana / D-Stitch) × Stitches Done
      table.decimal('rate', 8, 2).notNullable(); // User input
      table.decimal('per_yds', 10, 4).notNullable(); // Calculated: (D-Stitch / 1000) × 2.77 × Rate
      table.decimal('amount', 12, 2).notNullable(); // Calculated: Fabric × Per Yds
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Foreign key
      table.foreign('billing_record_id').references('id').inTable('daily_billing_records').onDelete('CASCADE');
      
      // Indexes
      table.index(['billing_record_id']);
      table.index(['design_no']);
      table.index(['shift']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('daily_billing_shift_records')
    .dropTableIfExists('daily_billing_records');
};
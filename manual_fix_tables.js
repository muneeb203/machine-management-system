const knex = require('knex');
const config = require('./knexfile');

async function createTables() {
    const db = knex(config.development);
    try {
        console.log('Manually creating tables...');

        // daily_billing_records
        await db.raw(`
      CREATE TABLE IF NOT EXISTS daily_billing_records (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        machine_id INT UNSIGNED NOT NULL,
        master_id INT UNSIGNED NOT NULL,
        billing_date DATE NOT NULL,
        total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        status ENUM('draft', 'saved', 'approved') DEFAULT 'draft',
        created_by INT UNSIGNED NOT NULL,
        approved_by INT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        INDEX idx_billing_date_machine (billing_date, machine_id),
        INDEX idx_status (status)
      )
    `);
        console.log('Table daily_billing_records created or already exists.');

        // daily_billing_shift_records
        await db.raw(`
      CREATE TABLE IF NOT EXISTS daily_billing_shift_records (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        billing_record_id INT UNSIGNED NOT NULL,
        design_no VARCHAR(50) NOT NULL,
        d_stitch INT NOT NULL,
        shift ENUM('day', 'night') NOT NULL,
        stitches_done INT NOT NULL,
        fabric DECIMAL(10, 4) NOT NULL,
        rate DECIMAL(8, 2) NOT NULL,
        per_yds DECIMAL(10, 4) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_billing_record (billing_record_id),
        INDEX idx_design_no (design_no),
        INDEX idx_shift (shift),
        FOREIGN KEY (billing_record_id) REFERENCES daily_billing_records(id) ON DELETE CASCADE
      )
    `);
        console.log('Table daily_billing_shift_records created or already exists.');

        // Mark migration as completed in knex_migrations table if it exists
        try {
            const migrationName = '20260203000001_create_optimized_billing_tables.js';
            const exists = await db('knex_migrations').where('name', migrationName).first();
            if (!exists) {
                await db('knex_migrations').insert({
                    name: migrationName,
                    batch: 999,
                    migration_time: new Date()
                });
                console.log('Migration marked as completed in knex_migrations table.');
            }
        } catch (e) {
            console.warn('Could not update knex_migrations table, but tables were created.');
        }

    } catch (error) {
        console.error('Failed to create tables:', error);
    } finally {
        await db.destroy();
    }
}

createTables();

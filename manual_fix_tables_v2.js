console.log('--- START SCRIPT ---');
const knex = require('knex');
const config = require('./knexfile');

async function createTables() {
    console.log('Connecting with config:', JSON.stringify({ ...config.development, connection: { ...config.development.connection, password: '****' } }));
    const db = knex(config.development);
    try {
        console.log('Executing CREATE TABLE for daily_billing_records...');
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('Table daily_billing_records created.');

        console.log('Executing CREATE TABLE for daily_billing_shift_records...');
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
        CONSTRAINT fk_billing_record FOREIGN KEY (billing_record_id) REFERENCES daily_billing_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log('Table daily_billing_shift_records created.');

        const tables = await db.raw('SHOW TABLES LIKE "daily_billing_%"');
        console.log('Verification - Tables found:', JSON.stringify(tables[0]));

    } catch (error) {
        console.error('FATAL ERROR:', error);
    } finally {
        console.log('Closing connection...');
        await db.destroy();
        console.log('--- END SCRIPT ---');
    }
}

createTables().catch(console.error);

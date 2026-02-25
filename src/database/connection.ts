import knex from 'knex';
import { config } from '../config';

// Database connection configuration
const dbConfig = {
  client: 'mysql2',
  connection: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    // MySQL specific options if needed
    multipleStatements: true,
    timezone: 'Z'
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
  },
};

// Create database instance
export const db = knex(dbConfig);

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await db.raw('SELECT 1');
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Graceful shutdown
export const closeConnection = async (): Promise<void> => {
  await db.destroy();
  console.log('Database connection closed');
};

// Transaction wrapper for data integrity
export const withTransaction = async <T>(
  callback: (trx: knex.Knex.Transaction) => Promise<T>
): Promise<T> => {
  console.log('[DEBUG] DB: starting transaction...');
  const trx = await db.transaction();
  try {
    const result = await callback(trx);
    console.log('[DEBUG] DB: committing transaction...');
    await trx.commit();
    console.log('[DEBUG] DB: transaction committed.');
    return result;
  } catch (error) {
    console.error('[DEBUG] DB: rolling back transaction...', error);
    await trx.rollback();
    throw error;
  }
};

// Audit logging helper
export const logAudit = async (
  tableName: string,
  recordId: number,
  action: 'insert' | 'update' | 'delete' | 'override',
  oldValues?: any,
  newValues?: any,
  userId?: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  await db('audit_logs').insert({
    table_name: tableName,
    record_id: recordId,
    action,
    old_values: oldValues ? JSON.stringify(oldValues) : null,
    new_values: newValues ? JSON.stringify(newValues) : null,
    user_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
    created_at: new Date(),
  });
};

export default db;
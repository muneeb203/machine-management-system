const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Clear existing entries
  await knex('users').del();
  await knex('machines').del();
  await knex('rate_elements').del();
  await knex('base_rates').del();

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  
  await knex('users').insert([
    {
      id: 1,
      username: 'admin',
      email: 'admin@embroidery-erp.com',
      password_hash: adminPasswordHash,
      role: 'admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      username: 'programmer1',
      email: 'programmer@embroidery-erp.com',
      password_hash: await bcrypt.hash('prog123', 12),
      role: 'programmer',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 3,
      username: 'operator1',
      email: 'operator@embroidery-erp.com',
      password_hash: await bcrypt.hash('oper123', 12),
      role: 'operator',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  // Create 22 machines grouped under 3 masters
  const machines = [];
  for (let i = 1; i <= 22; i++) {
    let masterGroup;
    if (i <= 8) masterGroup = 1;
    else if (i <= 15) masterGroup = 2;
    else masterGroup = 3;

    machines.push({
      id: i,
      machine_number: i,
      master_group: masterGroup,
      day_shift_capacity: 50000,
      night_shift_capacity: 45000,
      is_active: true,
      created_at: new Date(),
    });
  }
  await knex('machines').insert(machines);

  // Create base rate elements
  await knex('rate_elements').insert([
    {
      id: 1,
      name: 'Base Rate',
      description: 'Standard embroidery rate per stitch',
      rate_per_stitch: 0.001,
      is_active: true,
      created_by: 1,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      name: 'Borer',
      description: 'Additional rate for borer work',
      rate_per_stitch: 0.0002,
      is_active: true,
      created_by: 1,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 3,
      name: 'Sequence',
      description: 'Additional rate for sequence work',
      rate_per_stitch: 0.0003,
      is_active: true,
      created_by: 1,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 4,
      name: 'Tilla',
      description: 'Additional rate for metallic thread (Tilla)',
      rate_per_stitch: 0.0005,
      is_active: true,
      created_by: 1,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  // Create base rate
  await knex('base_rates').insert([
    {
      id: 1,
      rate_per_stitch: 0.001,
      effective_from: new Date('2024-01-01'),
      effective_to: null,
      is_active: true,
      created_by: 1,
      created_at: new Date(),
    },
  ]);

  // Reset sequences
  await knex.raw('ALTER SEQUENCE users_id_seq RESTART WITH 4');
  await knex.raw('ALTER SEQUENCE machines_id_seq RESTART WITH 23');
  await knex.raw('ALTER SEQUENCE rate_elements_id_seq RESTART WITH 5');
  await knex.raw('ALTER SEQUENCE base_rates_id_seq RESTART WITH 2');
};
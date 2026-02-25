/**
 * Migration: Sync ContractItemMachine.pending_stitches from production data
 * Fixes rows where pending was 0 (default) but assigned_stitches > 0.
 * Recalculates: pending = assigned_stitches - (ProductionEntry + daily_production_master)
 */

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('ContractItemMachine');
  if (!hasTable) return;

  const assignments = await knex('ContractItemMachine').select(
    'id',
    'ContractItemID',
    'MachineID',
    'assigned_stitches',
    'pending_stitches'
  );

  for (const row of assignments) {
    const contractItemId = row.ContractItemID;
    const machineId = row.MachineID;
    const assigned = Number(row.assigned_stitches || 0);

    // Sum from ProductionEntry
    const peResult = await knex('ProductionEntry')
      .where({ ContractItemID: contractItemId, MachineID: machineId })
      .sum('Stitches as total')
      .first();

    // Sum from daily_production_master (check if table exists)
    let dailyTotal = 0;
    try {
      const hasDailyTable = await knex.schema.hasTable('daily_production_master');
      if (hasDailyTable) {
        const dailyResult = await knex('daily_production_master')
          .where({ contract_item_id: contractItemId, machine_id: machineId })
          .sum('total_stitches as total')
          .first();
        dailyTotal = Number(dailyResult?.total || 0);
      }
    } catch (_) {
      // Table might not exist or column names differ
    }

    const producedFromEntry = Number(peResult?.total || 0);
    const totalProduced = producedFromEntry + dailyTotal;
    const newPending = assigned - totalProduced;

    // Determine status
    let status = 'Open';
    let completedAt = null;
    if (newPending < 0) {
      status = 'Overproduced';
      completedAt = new Date();
    } else if (newPending === 0 && totalProduced > 0) {
      status = 'Completed';
      completedAt = new Date();
    }

    await knex('ContractItemMachine')
      .where('id', row.id)
      .update({
        pending_stitches: newPending,
        status,
        completed_at: completedAt
      });
  }

  console.log(`✓ Synced pending_stitches for ${assignments.length} ContractItemMachine rows`);
};

exports.down = async function (knex) {
  // No safe revert - would need to store previous values
  console.log('Sync migration has no down - pending_stitches values remain as synced');
};

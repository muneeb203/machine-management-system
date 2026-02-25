import { db } from '../database/connection';

/**
 * Recalculate pending stitches and status for a specific machine assignment.
 * Should be called after any ProductionEntry Insert/Update/Delete.
 */
export async function recalculateMachineWorkload(contractItemId: number, machineId: number): Promise<void> {
    // 1. Get Assignment Details
    const assignment = await db('ContractItemMachine')
        .where({ ContractItemID: contractItemId, MachineID: machineId })
        .first();

    if (!assignment) return; // Should not happen if data integrity is maintained

    const assignedStitches = Number(assignment.assigned_stitches || 0);
    const avgStitches = Number(assignment.avg_stitches_per_day || 0);
    const avgDays = Number(assignment.estimated_days || assignment.avg_days || 0);

    // 2. Sum Production Stitches from BOTH ProductionEntry and daily_production_master
    const [productionStats, dailyStats] = await Promise.all([
        db('ProductionEntry')
            .where({ ContractItemID: contractItemId, MachineID: machineId })
            .sum('Stitches as totalProduced')
            .min('ProductionDate as firstDate')
            .max('ProductionDate as lastDate')
            .first(),
        db('daily_production_master')
            .where({ contract_item_id: contractItemId, machine_id: machineId })
            .sum('total_stitches as totalProduced')
            .first()
    ]);

    const producedFromEntry = Number(productionStats?.totalProduced || 0);
    const producedFromDaily = Number(dailyStats?.totalProduced || 0);
    const producedStitches = producedFromEntry + producedFromDaily;

    // 3. Optional: Clipping Integration (Placeholder)
    // const clippingStats = await db('ClippingItem').where(...).sum(...);
    // const clippingReceived = ...

    // 4. Calculate Pending
    let pending = assignedStitches - producedStitches;
    // if (pending < 0) pending = 0; // Negative means overproduction, keep as negative or clamp? 
    // Prompt says: "Overproduction: If produced > assigned, show negative pending (or zero and mark Overproduced). Keep produced independent; do not silently cap."
    // So we keep exact calculation.

    // 5. Calculate Time Logic
    let actualDays = 0;
    let status = 'Open';
    let completedAt = null;

    if (productionStats?.firstDate && productionStats?.lastDate) {
        const start = new Date(productionStats.firstDate);
        const end = new Date(productionStats.lastDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        actualDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive (1 day if start==end)
    }

    // 6. Determine Status
    // Logic: 
    // - If Pending <= 0 -> Completed (Check timestamps for efficiency)
    // - If Completed logic -> Check delay

    if (pending < 0) {
        status = 'Overproduced';
        completedAt = productionStats?.lastDate || new Date();
    } else if (pending === 0 && producedStitches > 0) {
        completedAt = productionStats?.lastDate || new Date();
        if (avgDays > 0 && actualDays > avgDays) {
            status = 'Delayed';
        } else {
            status = 'Completed';
        }
    } else {
        status = 'Open';
    }

    // 7. Update DB
    await db('ContractItemMachine')
        .where({ ContractItemID: contractItemId, MachineID: machineId })
        .update({
            pending_stitches: pending,
            status: status,
            completed_at: completedAt
        });
}

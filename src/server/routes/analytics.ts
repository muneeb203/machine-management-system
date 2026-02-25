import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { db } from '../../database/connection';

const router = Router();

router.use(authenticateToken);

// 1. Executive Summary KPIs
router.get('/kpis', async (req, res) => {
    try {
        // Active Contracts (IsActive = 1)
        const activeContracts = await db('Contract')
            .where('IsActive', 1)
            .count('ContractID as count')
            .first();

        // Completed Contracts (IsActive = 0)
        const completedContracts = await db('Contract')
            .where('IsActive', 0)
            .count('ContractID as count')
            .first();

        // Total Planned Stitches (Sum from Contract Items)
        const totalPlanned = await db('ContractItem')
            .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
            .sum(db.raw('CAST(ContractItem.Pieces AS UNSIGNED) * CAST(ContractItem.Stitch AS UNSIGNED) as total'))
            .first();

        // Total Completed Stitches (from both production tables)
        const totalCompleted = await db.raw(`
            SELECT SUM(total) as total FROM (
                SELECT SUM(Stitches) as total FROM ProductionEntry
                UNION ALL
                SELECT SUM(total_stitches) as total FROM daily_production_master
            ) as combined
        `);
        const totalCompletedCount = Number(totalCompleted[0][0]?.total || 0);

        // Machine Utilization (Active vs Total)
        const activeMachines = await db('Machine')
            .where('Status', 'running')
            .count('MachineID as count')
            .first();

        const totalMachines = await db('Machine')
            .count('MachineID as count')
            .first();

        const activeCount = Number(activeMachines?.count || 0);
        const totalCount = Number(totalMachines?.count || 0);
        const utilization = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

        const totalPlannedCount = Number((totalPlanned as any)?.total || 0);

        res.json({
            activeContracts: activeContracts?.count || 0,
            completedContracts: completedContracts?.count || 0,
            totalPlannedStitches: totalPlannedCount,
            totalCompletedStitches: totalCompletedCount,
            remainingStitches: Math.max(0, totalPlannedCount - totalCompletedCount),
            utilization
        });
    } catch (error) {
        console.error('Error fetching KPIs:', error);
        res.status(500).json({ error: 'Failed to fetch KPIs' });
    }
});

// 2. Contract Progress Analytics
router.get('/contracts', async (req, res) => {
    try {
        const contracts = await db('Contract')
            .select(
                'ContractID',
                'ContractNo',
                'IsActive',
                'Progress',
                'ContractEndDate as DeliveryDate',
                'CreatedAt'
            )
            .orderBy('CreatedAt', 'desc');

        const enrichedContracts = await Promise.all(contracts.map(async (contract) => {
            // Planned
            const planned = await db('ContractItem')
                .where('ContractID', contract.ContractID)
                .sum(db.raw('CAST(Pieces AS UNSIGNED) * CAST(Stitch AS UNSIGNED) as total'))
                .first();

            // Completed (Aggregated from both tables)
            const completed = await db.raw(`
                SELECT SUM(Stitches) as total FROM (
                    SELECT pe.Stitches 
                    FROM ProductionEntry pe
                    JOIN ContractItem ci ON pe.ContractItemID = ci.ContractItemID
                    WHERE ci.ContractID = ?
                    UNION ALL
                    SELECT dpm.total_stitches as Stitches
                    FROM daily_production_master dpm
                    JOIN ContractItem ci ON dpm.contract_item_id = ci.ContractItemID
                    WHERE ci.ContractID = ?
                ) as combined
            `, [contract.ContractID, contract.ContractID]);

            const completedVal = Number(completed[0][0]?.total || 0);
            const plannedVal = Number((planned as any)?.total || 0);

            // Time Progress
            const start = new Date(contract.CreatedAt).getTime();
            const end = new Date(contract.DeliveryDate).getTime();
            const now = new Date().getTime();
            let timeProgress = 0;
            if (end > start) {
                timeProgress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
            }

            return {
                ...contract,
                PartyName: 'N/A',
                Status: contract.IsActive ? 'Active' : 'Completed',
                plannedStitches: plannedVal,
                completedStitches: completedVal,
                progress: plannedVal > 0 ? Math.round((completedVal / plannedVal) * 100) : 0,
                timeProgress: Math.round(timeProgress)
            };
        }));

        const activeParams = enrichedContracts.filter(c => c.IsActive).length;
        const completedParams = enrichedContracts.filter(c => !c.IsActive).length;
        const delayedParams = enrichedContracts.filter(c => c.IsActive && new Date(c.DeliveryDate) < new Date()).length;

        res.json({
            contracts: enrichedContracts,
            statusPie: [
                { name: 'Active', value: activeParams },
                { name: 'Completed', value: completedParams },
                { name: 'Delayed', value: delayedParams }
            ]
        });

    } catch (error) {
        console.error('Error fetching Contract Analytics:', error);
        res.status(500).json({ error: 'Failed to fetch contract analytics' });
    }
});

// 3. Production Performance
router.get('/production', async (req, res) => {
    try {
        // Daily Trend (Combined)
        const dailyTrend = await db.raw(`
            SELECT date, SUM(stitches) as stitches FROM (
                SELECT DATE(ProductionDate) as date, SUM(Stitches) as stitches 
                FROM ProductionEntry 
                WHERE ProductionDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(ProductionDate)
                UNION ALL
                SELECT DATE(production_date) as date, SUM(total_stitches) as stitches 
                FROM daily_production_master 
                WHERE production_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(production_date)
            ) as combined
            GROUP BY date
            ORDER BY date ASC
        `);

        // Shift Trend (Combined)
        const shiftTrend = await db.raw(`
            SELECT Shift, SUM(stitches) as stitches FROM (
                SELECT Shift, SUM(Stitches) as stitches 
                FROM ProductionEntry 
                WHERE ProductionDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY Shift
                UNION ALL
                SELECT shift as Shift, SUM(total_stitches) as stitches 
                FROM daily_production_master 
                WHERE production_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY shift
            ) as combined
            GROUP BY Shift
        `);

        // Monthly Trend (Combined)
        const monthlyTrend = await db.raw(`
            SELECT month, month_num, SUM(stitches) as stitches FROM (
                SELECT MONTHNAME(ProductionDate) as month, MONTH(ProductionDate) as month_num, SUM(Stitches) as stitches 
                FROM ProductionEntry 
                WHERE YEAR(ProductionDate) = YEAR(NOW())
                GROUP BY MONTH(ProductionDate), MONTHNAME(ProductionDate)
                UNION ALL
                SELECT MONTHNAME(production_date) as month, MONTH(production_date) as month_num, SUM(total_stitches) as stitches 
                FROM daily_production_master 
                WHERE YEAR(production_date) = YEAR(NOW())
                GROUP BY MONTH(production_date), MONTHNAME(production_date)
            ) as combined
            GROUP BY month, month_num
            ORDER BY month_num ASC
        `);

        res.json({
            daily: dailyTrend[0],
            shift: shiftTrend[0],
            monthly: monthlyTrend[0]
        });
    } catch (error) {
        console.error('Error fetching production analytics:', error);
        res.status(500).json({ error: 'Failed to fetch production analytics' });
    }
});

// 4. Machine Performance
router.get('/machines', async (req, res) => {
    try {
        const combinedProduction = db.raw(`
            SELECT MachineID, SUM(Stitches) as totalProduction FROM (
                SELECT MachineID, Stitches FROM ProductionEntry
                UNION ALL
                SELECT machine_id as MachineID, total_stitches as Stitches FROM daily_production_master
            ) as combined
            GROUP BY MachineID
        `);

        const machineStats = await db('Machine')
            .leftJoin(db.raw(`(${combinedProduction.toString()}) as cp`), 'Machine.MachineID', 'cp.MachineID')
            .select('Machine.MachineNumber', 'Machine.Status')
            .select(db.raw('IFNULL(cp.totalProduction, 0) as totalProduction'))
            .orderBy('totalProduction', 'desc')
            .limit(10);

        const statusPie = await db('Machine')
            .select('Status as name')
            .count('MachineID as value')
            .groupBy('Status');

        res.json({
            machines: machineStats,
            statusPie
        });
    } catch (error) {
        console.error('Error fetching machine analytics:', error);
        res.status(500).json({ error: 'Failed to fetch machine analytics' });
    }
});

// 5. Operator Performance
router.get('/operators', async (req, res) => {
    try {
        const combinedOperators = db.raw(`
            SELECT OperatorName, SUM(Stitches) as production FROM (
                SELECT OperatorName, Stitches FROM ProductionEntry
                UNION ALL
                SELECT operator_name as OperatorName, total_stitches as Stitches FROM daily_production_master
            ) as combined
            WHERE OperatorName IS NOT NULL
            GROUP BY OperatorName
            ORDER BY production DESC
            LIMIT 10
        `);

        const operatorStats = await combinedOperators;

        res.json({
            operators: operatorStats[0]
        });
    } catch (error) {
        console.error('Error fetching operator analytics:', error);
        res.status(500).json({ error: 'Failed to fetch operator analytics' });
    }
});

// 6. Clipping (Outsourcing)
router.get('/clipping', async (req, res) => {
    try {
        const combinedInHouse = await db.raw(`
            SELECT SUM(total) as total FROM (
                SELECT SUM(Stitches) as total FROM ProductionEntry
                UNION ALL
                SELECT SUM(total_stitches) as total FROM daily_production_master
            ) as combined
        `);

        const outsourcing = await db('ClippingItem')
            .sum('Quantity as sent')
            .sum('ReceivedQty as received')
            .first();

        const vendors = await db('ClippingItem')
            .join('Clipping', 'ClippingItem.ClippingID', 'Clipping.ClippingID')
            .select('Clipping.VendorName')
            .sum(db.raw('Quantity - ReceivedQty as pending'))
            .groupBy('Clipping.VendorName')
            .orderBy('pending', 'desc');

        res.json({
            inHouseStitches: Number(combinedInHouse[0][0]?.total || 0),
            clipping: {
                sent: outsourcing?.sent || 0,
                received: outsourcing?.received || 0,
                pending: (outsourcing?.sent || 0) - (outsourcing?.received || 0)
            },
            vendors
        });
    } catch (error) {
        console.error('Error fetching clipping analytics:', error);
        res.status(500).json({ error: 'Failed to fetch clipping analytics' });
    }
});

export const analyticsRouter = router;

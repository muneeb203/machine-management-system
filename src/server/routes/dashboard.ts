import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/dashboard/kpis
 * Returns aggregated KPIs for the dashboard header
 */
router.get('/kpis', async (req, res) => {
    try {
        // 1. Active Machines
        const activeMachinesDict = await db('Machine')
            .where('IsActive', 1)
            .count('MachineID as count')
            .first();
        const activeMachines = Number(activeMachinesDict?.count || 0);

        // 2. Active Contracts
        const activeContractsDict = await db('Contract')
            .where('IsActive', 1)
            .count('ContractID as count')
            .first();
        const activeContracts = Number(activeContractsDict?.count || 0);

        // 3. Today's Production (Combined)
        const todayProd = await db.raw(`
            SELECT SUM(total) as total FROM (
                SELECT SUM(Stitches) as total FROM ProductionEntry WHERE DATE(ProductionDate) = CURRENT_DATE()
                UNION ALL
                SELECT SUM(total_stitches) as total FROM daily_production_master WHERE DATE(production_date) = CURRENT_DATE()
            ) as combined
        `);
        const todayProduction = Number(todayProd[0][0]?.total || 0);

        // 4. Pending Billing (Placeholder as 'bills' table is missing)
        // We return 0 or a flag to indicate configuration needed.
        const pendingBilling = 0;

        // 5. Machine Utilization % (Machines with production in last 7 days / Total Active Machines)
        const machinesWithProd = await db.raw(`
            SELECT COUNT(DISTINCT MachineID) as count FROM (
                SELECT MachineID FROM ProductionEntry WHERE ProductionDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                UNION
                SELECT machine_id as MachineID FROM daily_production_master WHERE production_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
            ) as combined
        `);
        const utilizedCount = Number(machinesWithProd[0][0]?.count || 0);
        const utilization = activeMachines > 0 ? Math.round((utilizedCount / activeMachines) * 100) : 0;

        // 6. Recent Activity Timestamp (Latest from feed queries)
        // We'll fetch this fully in the feed endpoint, but for KPI card we can just query max date from a few,
        // or arguably just return the current time if we assume the system is active. 
        // 6. Recent Activity Timestamp
        const lastProd = await db.raw(`
            SELECT MAX(sortDate) as last FROM (
                SELECT Updated_at as sortDate FROM ProductionEntry
                UNION ALL
                SELECT updated_at as sortDate FROM daily_production_master
            ) as combined
        `);
        const recentActivity = lastProd[0][0]?.last || null;

        res.json({
            activeMachines,
            activeContracts,
            todayProduction,
            pendingBilling,
            utilization,
            recentActivity
        });
    } catch (error) {
        console.error('Error fetching dashboard KPIs:', error);
        res.status(500).json({ error: 'Failed to fetch KPIs' });
    }
});

/**
 * GET /api/dashboard/production-trend
 * Returns last 30 days daily sum and shift breakdown
 */
router.get('/production-trend', async (req, res) => {
    try {
        const days = 30;
        const trend = await db.raw(`
            SELECT date, SUM(total) as total, SUM(morning) as morning, SUM(night) as night FROM (
                SELECT 
                    DATE(ProductionDate) as date,
                    SUM(Stitches) as total,
                    SUM(CASE WHEN Shift = 'Morning' THEN Stitches ELSE 0 END) as morning,
                    SUM(CASE WHEN Shift = 'Night' OR Shift = 'Evening' THEN Stitches ELSE 0 END) as night
                FROM ProductionEntry
                WHERE ProductionDate >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)
                GROUP BY DATE(ProductionDate)
                UNION ALL
                SELECT 
                    DATE(production_date) as date,
                    SUM(total_stitches) as total,
                    SUM(CASE WHEN shift = 'Morning' THEN total_stitches ELSE 0 END) as morning,
                    SUM(CASE WHEN shift = 'Night' OR shift = 'Evening' THEN total_stitches ELSE 0 END) as night
                FROM daily_production_master
                WHERE production_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)
                GROUP BY DATE(production_date)
            ) as combined
            GROUP BY date
            ORDER BY date ASC
        `, [days, days]);

        res.json(trend);
    } catch (error) {
        console.error('Error fetching production trend:', error);
        res.status(500).json({ error: 'Failed to fetch trends' });
    }
});

/**
 * GET /api/dashboard/machine-stats
 * Returns top 10 machines by volume and status distribution
 */
router.get('/machine-stats', async (req, res) => {
    try {
        // Top Machines (Combined)
        const topMachinesResult = await db.raw(`
            SELECT MachineNumber, SUM(stitches) as stitches FROM (
                SELECT Machine.MachineNumber, SUM(ProductionEntry.Stitches) as stitches
                FROM Machine
                JOIN ProductionEntry ON Machine.MachineID = ProductionEntry.MachineID
                WHERE ProductionEntry.ProductionDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
                GROUP BY Machine.MachineID, Machine.MachineNumber
                UNION ALL
                SELECT Machine.MachineNumber, SUM(daily_production_master.total_stitches) as stitches
                FROM Machine
                JOIN daily_production_master ON Machine.MachineID = daily_production_master.machine_id
                WHERE daily_production_master.production_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
                GROUP BY Machine.MachineID, Machine.MachineNumber
            ) as combined
            GROUP BY MachineNumber
            ORDER BY stitches DESC
            LIMIT 10
        `);
        const topMachines = topMachinesResult[0];

        // Status Pie
        const statusPie = await db('Machine')
            .select('Status as name')
            .count('MachineID as value')
            .groupBy('Status');

        res.json({ topMachines, statusPie });
    } catch (error) {
        console.error('Error fetching machine stats:', error);
        res.status(500).json({ error: 'Failed to fetch machine stats' });
    }
});

/**
 * GET /api/dashboard/contract-progress
 * Returns active contracts with progress %
 */
router.get('/contract-progress', async (req, res) => {
    try {
        const contracts = await db('Contract')
            .select(
                'Contract.ContractID',
                'Contract.ContractNo',
                'Contract.ContractEndDate',
                'Contract.Progress' // We have this calculated column, let's use it or recalculate if needed
            )
            .sum('ContractItem.Stitch as plannedStitches')
            // Note: Joining ProductionEntry here for aggregate sum might be heavy or need distinct handling if multiple items.
            // Better to subquery or use the pre-calculated 'Progress' column if trusted.
            // Detailed prompt asked for: ContractNo, Client (N/A), % Stitches Complete, % Repeats Complete, Days Remaining.
            // Let's rely on the UpdateContractProgress service method having run, OR calculation on the fly.
            // Calculating on the fly for Dashboard is safer for real-time.
            .leftJoin('ContractItem', 'Contract.ContractID', 'ContractItem.ContractID')
            .groupBy('Contract.ContractID', 'Contract.ContractNo', 'Contract.ContractEndDate', 'Contract.Progress')
            .orderBy('Contract.ContractID', 'desc');

        // We need used stitches.
        // It's cleaner to fetch this separately or via subquery.
        // Let's iterate the top 8 (usually few).
        const enriched = await Promise.all(contracts.map(async (c: any) => {
            const prodResult = await db.raw(`
                SELECT SUM(completed) as completed FROM (
                    SELECT SUM(Stitches) as completed 
                    FROM ProductionEntry pe
                    JOIN ContractItem ci ON pe.ContractItemID = ci.ContractItemID
                    WHERE ci.ContractID = ?
                    UNION ALL
                    SELECT SUM(total_stitches) as completed
                    FROM daily_production_master dpm
                    JOIN ContractItem ci ON dpm.contract_item_id = ci.ContractItemID
                    WHERE ci.ContractID = ?
                ) as combined
            `, [c.ContractID, c.ContractID]);
            const prod = prodResult[0][0];

            const planned = (await db('ContractItem')
                .where('ContractID', c.ContractID)
                .select(db.raw('sum(CAST(Pieces AS UNSIGNED) * CAST(Stitch AS UNSIGNED)) as total'))
                .first()) as any;

            const completed = Number(prod?.completed || 0);
            const total = Number(planned?.total || 1); // Avoid 0 div

            const completionPct = Math.min(100, Math.round((completed / total) * 100));

            // Days remaining
            const end = c.ContractEndDate ? new Date(c.ContractEndDate) : new Date();
            const now = new Date();
            const diffTime = end.getTime() - now.getTime();
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return {
                id: c.ContractID,
                contractNo: c.ContractNo,
                client: 'N/A', // Schema missing
                completionPct,
                daysRemaining
            };
        }));

        // Result is already sorted by ContractID desc from the first query
        // We'll keep that order instead of sorting by completion percentage
        // enriched.sort((a, b) => a.completionPct - b.completionPct);

        res.json(enriched);
    } catch (error) {
        console.error('Error fetching contract progress:', error);
        res.status(500).json({ error: 'Failed to fetch contract progress' });
    }
});

/**
 * GET /api/dashboard/recent-activity
 * Unified feed of Production, Gate Pass, Clipping, Contracts
 */
router.get('/recent-activity', async (req, res) => {
    try {
        const limit = 30;

        // 1. Production
        // Using a typed approach or raw union. Raw is easier for Union across tables in Knex.
        // Note: Column names must match across unions.
        const query = db.raw(`
      (SELECT 
        'production' as type, 
        ProductionID as id, 
        ProductionDate as date, 
        CONCAT('Production: ', Stitches, ' stitches on Machine ', Machine.MachineNumber) as summary,
        ProductionEntry.Updated_at as sortDate
       FROM ProductionEntry 
       JOIN Machine ON ProductionEntry.MachineID = Machine.MachineID
       ORDER BY ProductionEntry.Updated_at DESC LIMIT ?)
       
      UNION ALL
      
      (SELECT 
         'production' as type, 
         id as id, 
         production_date as date, 
         CONCAT('Production (Master): ', total_stitches, ' stitches on Machine ', Machine.MachineNumber) as summary,
         daily_production_master.updated_at as sortDate
       FROM daily_production_master 
       JOIN Machine ON daily_production_master.machine_id = Machine.MachineID
       ORDER BY daily_production_master.updated_at DESC LIMIT ?)
       
      UNION ALL
      
      (SELECT 
         'gatepass' as type, 
         GatePassID as id, 
         PassDate as date, 
         CONCAT('Gate Pass ', PassNumber, ' (', Type, ')') as summary,
         Updated_at as sortDate
       FROM GatePass
       ORDER BY Updated_at DESC LIMIT ?)
       
      UNION ALL
      
      (SELECT 
         'clipping' as type, 
         ClippingItemID as id, 
         DATE(Updated_at) as date, 
         CONCAT('Clipping Sent: ', Quantity, ' pcs') as summary,
         Updated_at as sortDate
       FROM ClippingItem
       ORDER BY Updated_at DESC LIMIT ?)
       
      ORDER BY sortDate DESC
      LIMIT ?
    `, [limit, limit, limit, limit, limit]);

        const result = await query;
        // Knex raw result structure depends on driver. For mysql2 it's [rows, fields].
        const rows = result[0] || [];

        res.json(rows);
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

export const dashboardRouter = router;

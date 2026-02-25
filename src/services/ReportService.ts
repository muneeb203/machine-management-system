import { db } from '../database/connection';

interface KPIReport {
    activeContracts: number;
    plannedStitches: number;
    completedStitches: number;
    remainingStitches: number;
    machineUtilization: number;
}

export class ReportService {

    /**
     * Get Executive Summary KPIs
     * @param startDate Date range start (optional filter for production/completed stitches)
     * @param endDate Date range end (optional)
     */
    static async getKPIs(startDate?: string, endDate?: string): Promise<KPIReport> {
        // 1. Active Contracts
        const activeContractsData = await db('Contract')
            .where('IsActive', 1)
            .count('ContractID as count')
            .first();
        const activeContracts = Number(activeContractsData?.count || 0);

        // 2. Total Planned Stitches (from Active Contracts)
        // Join ContractItem -> Contract to filter by Active
        const plannedData = await db('ContractItem')
            .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
            .where('Contract.IsActive', 1)
            .sum('ContractItem.Stitch as total')
            .first();
        const plannedStitches = Number(plannedData?.total || 0);

        // 3. Completed Stitches (Total Produced)
        // If date range provided, filter by ProductionDate
        let productionQuery = db('ProductionEntry').sum('Stitches as total');

        if (startDate && endDate) {
            productionQuery = productionQuery.whereBetween('ProductionDate', [startDate, endDate]);
        }

        const completedData = await productionQuery.first();
        const completedStitches = Number(completedData?.total || 0);

        // 4. Remaining Stitches
        // Simplified: Planned (Active) - Completed (Active Contracts only? Or global?)
        // Usually Executive Summary matches "Active Work". 
        // Let's calculate Remaining as (Planned from Active) - (Produced against Active Contracts).

        const producedAgainstActiveData = await db('ProductionEntry')
            .join('ContractItem', 'ProductionEntry.ContractItemID', 'ContractItem.ContractItemID')
            .join('Contract', 'ContractItem.ContractID', 'Contract.ContractID')
            .where('Contract.IsActive', 1)
            .sum('ProductionEntry.Stitches as total')
            .first();
        const producedAgainstActive = Number(producedAgainstActiveData?.total || 0);

        const remainingStitches = Math.max(0, plannedStitches - producedAgainstActive);

        // 5. Machine Utilization (Active Machines / Total Machines)
        // Active = Machines with at least one entry in date range (or today if no range)
        let machineQuery = db('ProductionEntry').countDistinct('MachineID as count');
        if (startDate && endDate) {
            machineQuery = machineQuery.whereBetween('ProductionDate', [startDate, endDate]);
        } else {
            // Default to last 30 days if no date? Or Today? 
            // Required for meaningful utilization. Let's assume global "Ever Active" if no date is weird.
            // Let's default to "Last 7 days" if no date provided for relevance.
            const last7 = new Date();
            last7.setDate(last7.getDate() - 7);
            machineQuery = machineQuery.where('ProductionDate', '>=', last7);
        }
        const activeMachinesData = await machineQuery.first();
        const activeMachinesCount = Number(activeMachinesData?.count || 0);

        // Total Machines
        const totalMachinesData = await db('Machine').count('MachineID as count').first();
        const totalMachines = Number(totalMachinesData?.count || 0);

        const machineUtilization = totalMachines > 0 ? (activeMachinesCount / totalMachines) * 100 : 0;

        return {
            activeContracts,
            plannedStitches,
            completedStitches,
            remainingStitches,
            machineUtilization: parseFloat(machineUtilization.toFixed(2))
        };
    }

    /**
     * Contract Progress Report
     * Returns list of contracts with planned vs used stitches and % completion
     */
    static async getContractProgress(contractId?: number) {
        let query = db('Contract as c')
            .join('ContractItem as ci', 'c.ContractID', 'ci.ContractID')
            .leftJoin('ProductionEntry as p', 'ci.ContractItemID', 'p.ContractItemID')
            .select(
                'c.ContractID',
                'c.ContractNo as ContractNumber',
                'ci.Collection',
                db.raw('SUM(ci.Stitch) as planned_stitches'),
                db.raw('COALESCE(SUM(p.Stitches), 0) as used_stitches')
            )
            .groupBy('c.ContractID', 'c.ContractNo', 'ci.Collection');

        if (contractId) {
            query = query.where('c.ContractID', contractId);
        }

        const results = await query;
        return results.map((r: any) => ({
            ...r,
            progress: r.planned_stitches > 0 ? ((r.used_stitches / r.planned_stitches) * 100).toFixed(1) : 0
        }));
    }

    /**
     * Production Trend Report
     * Daily stitches and shift breakdown
     */
    static async getProductionTrends(startDate: string, endDate: string) {
        const results = await db('ProductionEntry')
            .select(
                'ProductionDate',
                db.raw('SUM(Stitches) as total'),
                db.raw("SUM(CASE WHEN Shift = 'Morning' THEN Stitches ELSE 0 END) as morning"),
                db.raw("SUM(CASE WHEN Shift = 'Night' THEN Stitches ELSE 0 END) as night")
                // Adjust 'Shift' values if your DB uses different case/values (e.g. 'Day', 'Night')
            )
            .whereBetween('ProductionDate', [startDate, endDate])
            .groupBy('ProductionDate')
            .orderBy('ProductionDate', 'asc');

        return results;
    }

    static async getMachinePerformance(startDate: string, endDate: string) {
        const results = await db('ProductionEntry as p')
            .join('Machine as m', 'p.MachineID', 'm.MachineID')
            .select(
                'm.MachineNumber',
                'm.master_machine_number',
                db.raw('SUM(p.Stitches) as total_stitches'),
                db.raw('COUNT(p.ProductionID) as entry_count')
            )
            .whereBetween('p.ProductionDate', [startDate, endDate])
            .groupBy('m.MachineID', 'm.MachineNumber', 'm.master_machine_number')
            .orderBy('total_stitches', 'desc');
        return results;
    }

    static async getOperatorPerformance(startDate: string, endDate: string) {
        const results = await db('ProductionEntry')
            .select(
                'OperatorName',
                db.raw('SUM(Stitches) as total_stitches'),
                db.raw('COUNT(ProductionID) as entry_count')
            )
            .whereBetween('ProductionDate', [startDate, endDate])
            .whereNotNull('OperatorName')
            .where('OperatorName', '!=', '')
            .groupBy('OperatorName')
            .orderBy('total_stitches', 'desc');
        return results;
    }


    /**
     * Clipping Report
     * Lists clipping orders and items with vendor details
     */
    static async getClippingReports(startDate?: string, endDate?: string, vendorId?: number, status?: string) {
        let query = db('ClippingItem as ci')
            .join('Clipping as c', 'ci.ClippingID', 'c.ClippingID')
            .leftJoin('ClippingVendors as v', 'c.VendorID', 'v.id')
            .select(
                'c.ClippingID',
                'c.VendorName', // Fallback if VendorID null or keep legacy
                'v.vendor_name as VendorNameRef',
                'c.ContactNumber',
                'c.CNIC',
                'ci.ClippingItemID',
                'ci.ContractItemID',
                'ci.Description',
                'ci.QuantitySent',
                'ci.QuantityReceived',
                'ci.DateSent',
                'ci.LastReceivedDate',
                'ci.Status',
                'c.CreatedAt'
            )
            .orderBy('c.CreatedAt', 'desc');

        if (startDate && endDate) {
            query = query.whereBetween('ci.DateSent', [startDate, endDate]);
        }

        if (vendorId) {
            query = query.where('c.VendorID', vendorId);
        }

        if (status) {
            query = query.where('ci.Status', status);
        }

        const results = await query;

        // Post-process for display
        return results.map((r: any) => ({
            ...r,
            VendorName: r.VendorNameRef || r.VendorName, // Prefer linked vendor name
            PendingQuantity: Math.max(0, r.QuantitySent - (r.QuantityReceived || 0))
        }));
    }

    /**
     * Gatepass Report
     * Lists gate passes and items
     */
    static async getGatepassReports(startDate?: string, endDate?: string, type?: string) {
        let query = db('GatePassItem as gpi')
            .join('GatePass as gp', 'gpi.GatePassID', 'gp.GatePassID')
            .leftJoin('Contract as c', 'gp.ContractID', 'c.ContractID')
            .select(
                'gp.GatePassID',
                'gp.PassNumber',
                'gp.Type', // Inward / Outward
                'gp.Date as PassDate',
                'c.ContractNo',
                'gp.CarrierName',
                'gp.VehicleNumber',
                'gp.DriverName',
                'gp.Status',
                'gpi.Description as ItemDescription',
                'gpi.Quantity',
                'gpi.Unit',
                'gpi.Remarks'
            )
            .orderBy('gp.Date', 'desc');

        if (startDate && endDate) {
            query = query.whereBetween('gp.Date', [startDate, endDate]);
        }

        if (type && type !== 'all') {
            query = query.where('gp.Type', type);
        }

        return await query;
    }
}

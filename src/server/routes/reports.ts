import express, { Request, Response } from 'express';
import { ReportService } from '../../services/ReportService';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

/**
 * GET /api/reports/kpi
 * Query Params: startDate, endDate
 */
router.get('/kpi', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const kpis = await ReportService.getKPIs(startDate as string, endDate as string);
  res.json({ data: kpis });
}));

router.get('/contract-progress', asyncHandler(async (req: Request, res: Response) => {
  const { contractId } = req.query;
  const data = await ReportService.getContractProgress(contractId ? Number(contractId) : undefined);
  res.json({ data });
}));

router.get('/production-trend', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'startDate and endDate are required' });
    return;
  }
  const data = await ReportService.getProductionTrends(startDate as string, endDate as string);
  res.json({ data });
}));

router.get('/machine-performance', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'startDate and endDate are required' });
    return;
  }
  const data = await ReportService.getMachinePerformance(startDate as string, endDate as string);
  res.json({ data });
}));

router.get('/operator-performance', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'startDate and endDate are required' });
    return;
  }
  const data = await ReportService.getOperatorPerformance(startDate as string, endDate as string);
  res.json({ data });
}));

/**
 * GET /api/reports/clipping
 * Query Params: startDate, endDate, vendorId, status
 */
router.get('/clipping', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, vendorId, status } = req.query;
  const data = await ReportService.getClippingReports(
    startDate as string,
    endDate as string,
    vendorId ? Number(vendorId) : undefined,
    status as string
  );
  res.json({ data });
}));

/**
 * GET /api/reports/gatepass
 * Query Params: startDate, endDate, type
 */
router.get('/gatepass', asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, type } = req.query;
  const data = await ReportService.getGatepassReports(
    startDate as string,
    endDate as string,
    type as string
  );
  res.json({ data });
}));

export const reportsRouter = router;
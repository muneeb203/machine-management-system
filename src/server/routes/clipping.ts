
import { Router, Request, Response } from 'express';
import { authenticateToken, requireOperator, AuthenticatedRequest } from '../middleware/auth';
import { ClippingService } from '../../services/ClippingService';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.use(authenticateToken);

// Create Clip
router.post('/', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clippingId = await ClippingService.createClip(req.body, req.user!.id);
    res.status(201).json({ data: clippingId, message: 'Clip created successfully' });
}));

// Get All Clips
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const { vendor } = req.query;
    const clips = await ClippingService.getAllClips(vendor as string);
    res.json({ data: clips });
}));

// Update Clip
router.put('/:id', requireOperator, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await ClippingService.updateClip(parseInt(id), req.body, req.user!.id);
    res.json({ message: 'Clip updated successfully' });
}));

// Receive Work
router.put('/:id/items/:itemId/receive', requireOperator, asyncHandler(async (req: Request, res: Response) => {
    const { id, itemId } = req.params;
    const { quantity, date } = req.body; // quantity received, date received

    await ClippingService.receiveWork(
        parseInt(id),
        parseInt(itemId),
        parseFloat(quantity),
        date
    );

    res.json({ message: 'Work received successfully' });
}));

export default router;

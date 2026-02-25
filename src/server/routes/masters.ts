import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../../database/connection';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/masters
 * List all masters
 */
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const masters = await db('MachineMaster')
        .select('*')
        .orderBy('CreatedAt', 'desc');

    res.json({ data: masters });
}));

/**
 * POST /api/masters
 * Create a new master
 */
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, age, contactNumber, cnic, status } = req.body;

    // Validation
    if (!name || !age || !contactNumber || !cnic) {
        return res.status(400).json({ message: 'Name, Age, Contact Number, and CNIC are required' });
    }

    if (isNaN(Number(age))) {
        return res.status(400).json({ message: 'Age must be a number' });
    }

    // Check unique CNIC
    const existing = await db('MachineMaster').where('CNIC', cnic).first();
    if (existing) {
        return res.status(400).json({ message: `CNIC ${cnic} already exists` });
    }

    const [id] = await db('MachineMaster').insert({
        Name: name,
        Age: Number(age),
        ContactNumber: contactNumber,
        CNIC: cnic,
        Status: status || 'Active',
    }).returning('MasterID');

    // Fetch inserted record (compatible with sqlite/pg/mysql pattern in this app)
    const newMaster = await db('MachineMaster').where('MasterID', typeof id === 'object' ? id.MasterID : id).first();

    res.status(201).json({
        message: 'Master created successfully',
        data: newMaster
    });
}));

/**
 * PUT /api/masters/:id
 * Update a master
 */
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const { name, age, contactNumber, cnic, status } = req.body;

    // Check if master exists
    const master = await db('MachineMaster').where('MasterID', id).first();
    if (!master) {
        return res.status(404).json({ message: 'Master not found' });
    }

    // Check unique CNIC if changing
    if (cnic && cnic !== master.CNIC) {
        const existing = await db('MachineMaster').where('CNIC', cnic).first();
        if (existing) {
            return res.status(400).json({ message: `CNIC ${cnic} already exists` });
        }
    }

    const updates: any = { UpdatedAt: new Date() };
    if (name) updates.Name = name;
    if (age) updates.Age = Number(age);
    if (contactNumber) updates.ContactNumber = contactNumber;
    if (cnic) updates.CNIC = cnic;
    if (status) updates.Status = status;

    await db('MachineMaster').where('MasterID', id).update(updates);
    const updated = await db('MachineMaster').where('MasterID', id).first();

    res.json({
        message: 'Master updated successfully',
        data: updated
    });
}));

export { router as mastersRouter };

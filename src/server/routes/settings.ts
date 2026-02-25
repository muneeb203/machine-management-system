import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../../database/connection';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'));
        }
        cb(null, true);
    }
});

// Admin Check Middleware
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: any) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    next();
};

router.use(authenticateToken);

/**
 * GET /api/settings/factory
 * Get factory details
 */
router.get('/factory', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const details = await db('factory_details').where('is_active', true).first();
    res.json({ data: details || {} });
}));

/**
 * PUT /api/settings/factory
 * Update factory details (Admin only)
 */
router.put('/factory', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { factory_name, address, phone, email, tax_registration, website, footer_text } = req.body;

    if (!factory_name) {
        return res.status(400).json({ message: 'Factory Name is required' });
    }

    // Update active record (assuming only one active for now)
    // Or upsert logic
    const existing = await db('factory_details').where('is_active', true).first();

    if (existing) {
        await db('factory_details').where('id', existing.id).update({
            factory_name, address, phone, email, tax_registration, website, footer_text,
            updated_at: new Date()
        });
    } else {
        await db('factory_details').insert({
            factory_name, address, phone, email, tax_registration, website, footer_text,
            is_active: true
        });
    }

    // Log Action
    await db('audit_logs').insert({
        user_id: req.user!.id,
        action: 'UPDATE_FACTORY_DETAILS',
        table_name: 'factory_details',
        record_id: existing ? existing.id : null,
        new_values: JSON.stringify({ message: 'Updated factory settings' }),
        created_at: new Date()
    });

    res.json({ message: 'Factory details updated successfully.' });
}));

/**
 * POST /api/settings/factory/logo
 * Upload logo
 */
router.post('/factory/logo', requireAdmin, upload.single('logo'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    // URL path (relative to server serving static)
    // We will serve /uploads via express.static
    const logoUrl = `/uploads/${req.file.filename}`;

    const existing = await db('factory_details').where('is_active', true).first();
    if (existing) {
        await db('factory_details').where('id', existing.id).update({
            logo_url: logoUrl,
            updated_at: new Date()
        });
    } else {
        await db('factory_details').insert({
            factory_name: 'Your Factory Name',
            logo_url: logoUrl,
            is_active: true
        });
    }

    // Log
    await db('audit_logs').insert({
        user_id: req.user!.id,
        action: 'UPDATE_FACTORY_LOGO',
        table_name: 'factory_details',
        record_id: existing ? existing.id : null,
        new_values: JSON.stringify({ message: 'Uploaded new factory logo' }),
        created_at: new Date()
    });

    res.json({ message: 'Logo uploaded successfully.', logoUrl });
}));

export const settingsRouter = router;

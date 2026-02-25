import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Validation schema for bill item
 */
const billItemSchema = Joi.object({
    design_no: Joi.string().max(100).optional().allow(null, ''),
    collection: Joi.string().max(100).optional().allow(null, ''),
    component: Joi.string().max(100).optional().allow(null, ''),
    item_description: Joi.string().max(255).optional().allow(null, ''),
    qty: Joi.number().min(0).optional().allow(null),
    stitches: Joi.number().min(0).required(),
    rate_per_unit: Joi.number().min(0).required(),
    rate_type: Joi.string().valid('HDS', 'SHEET', 'FUSING').required()
}).unknown(true);

/**
 * Validation schema for bill header
 */
const billSchema = Joi.object({
    bill_number: Joi.string().max(50).optional(),
    bill_date: Joi.date().iso().required(),
    party_name: Joi.string().max(255).required(),
    po_number: Joi.string().max(100).optional().allow(null, ''),
    contract_id: Joi.number().integer().optional().allow(null),
    items: Joi.array().items(billItemSchema).optional()
}).unknown(true);

/**
 * Middleware to validate bill header data
 */
export const validateBill = (req: Request, res: Response, next: NextFunction): void => {
    const { error } = billSchema.validate(req.body);

    if (error) {
        res.status(400).json({
            error: 'Validation failed',
            details: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            })),
        });
        return;
    }

    next();
};

/**
 * Middleware to validate bill item data
 */
export const validateBillItem = (req: Request, res: Response, next: NextFunction): void => {
    const { error } = billItemSchema.validate(req.body);

    if (error) {
        res.status(400).json({
            error: 'Validation failed',
            details: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            })),
        });
        return;
    }

    next();
};

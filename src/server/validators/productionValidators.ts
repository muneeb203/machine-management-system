import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const productionEntrySchema = Joi.object({
  machineId: Joi.number().integer().min(1).required(),
  designId: Joi.number().integer().min(1).required(),
  productionDate: Joi.date().iso().required(),
  shift: Joi.string().valid('day', 'night').required(),
  actualStitches: Joi.number().integer().min(0).required(),
  genuineStitches: Joi.number().integer().min(0).optional(),
  repeatsCompleted: Joi.number().integer().min(0).required(),
  operatorName: Joi.string().min(1).max(100).required(),
  notes: Joi.string().max(500).optional(),
});

const bulkProductionSchema = Joi.object({
  entries: Joi.array().items(productionEntrySchema).min(1).max(50).required(),
});

const stitchOverrideSchema = Joi.object({
  productionEntryId: Joi.number().integer().min(1).required(),
  newStitches: Joi.number().integer().min(0).required(),
  reason: Joi.string().min(5).max(500).required(),
});

export const validateProductionEntry = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = productionEntrySchema.validate(req.body);
  
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

export const validateBulkProduction = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = bulkProductionSchema.validate(req.body);
  
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

export const validateStitchOverride = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = stitchOverrideSchema.validate(req.body);
  
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
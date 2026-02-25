import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const contractSchema = Joi.object({
  contractNumber: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  contractDate: Joi.date().iso().required(),
  contractEndDate: Joi.date().iso().min(Joi.ref('contractDate')).optional().allow(null, '').messages({
    'date.min': 'Contract End Date cannot be before Contract Start Date'
  }),
  contractDuration: Joi.number().optional().allow(null),
  poNumber: Joi.string().required().max(50),
  status: Joi.string().valid('draft', 'active', 'completed', 'cancelled').optional(),
  items: Joi.array().optional().items(Joi.object().unknown(true))
});

const designSchema = Joi.object({
  designNumber: Joi.string().required().min(1).max(50),
  component: Joi.string().required().min(1).max(50),
  repeatType: Joi.string().valid('yards', 'pieces').required(),
  repeatValue: Joi.number().integer().min(1).when('repeatType', {
    is: 'yards',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  plannedQuantity: Joi.number().integer().min(1).required(),
  plannedStitchCount: Joi.number().integer().min(0).optional(),
  rateElements: Joi.array().items(
    Joi.object({
      rateElementId: Joi.number().integer().required(),
      isSelected: Joi.boolean().required(),
    })
  ).required(),
});

export const validateContract = (req: Request, res: Response, next: NextFunction): void => {
  console.log('[DEBUG] validateContract - Start');
  const { error } = contractSchema.validate(req.body);

  if (error) {
    console.log('[DEBUG] validateContract - Error:', error.message);
    res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
    return;
  }

  console.log('[DEBUG] validateContract - Success');
  next();
};

export const validateDesign = (req: Request, res: Response, next: NextFunction): void => {
  const { error } = designSchema.validate(req.body);

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
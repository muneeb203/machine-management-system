import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const contractSchema = Joi.object({
  contractNumber: Joi.string().required().min(1).max(50),
  partyName: Joi.string().required().min(1).max(100),
  poNumber: Joi.string().optional().max(50),
  gatePassNumber: Joi.string().optional().max(50),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().optional().greater(Joi.ref('startDate')),
  collectionName: Joi.string().optional().max(100),
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
  const { error } = contractSchema.validate(req.body);
  
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
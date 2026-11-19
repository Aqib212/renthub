import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { PaymentService } from "./payment.service";
import { createPaymentSchema, updatePaymentSchema, paymentQuerySchema } from "./payment.validation";

const paymentService = new PaymentService();

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = createPaymentSchema.parse(req.body);
    const result = await paymentService.create(req.user!.userId, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const findAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = paymentQuerySchema.parse(req.query);
    const result = await paymentService.findAll(req.user!.userId, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const findById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.findById(req.user!.userId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = updatePaymentSchema.parse(req.body);
    const result = await paymentService.update(req.user!.userId, req.params.id, body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await paymentService.remove(req.user!.userId, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

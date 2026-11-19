import { sendResult } from "../../shared/utils/apiResponse";
import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { PaymentService } from "./payment.service";
import { createPaymentSchema, updatePaymentSchema, paymentQuerySchema } from "./payment.validation";

const paymentService = new PaymentService();

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = createPaymentSchema.parse(req.body);
    const result = await paymentService.create(String(req.org!.id), body, req.org!.membershipId);
    sendResult(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const findAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = paymentQuerySchema.parse(req.query);
    const result = await paymentService.findAll(String(req.org!.id), query);
    sendResult(res, result);
  } catch (error) {
    next(error);
  }
};

export const findById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.findById(String(req.org!.id), req.params.id);
    sendResult(res, result);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = updatePaymentSchema.parse(req.body);
    const result = await paymentService.update(String(req.org!.id), req.params.id, body);
    sendResult(res, result);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await paymentService.remove(String(req.org!.id), req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const receipt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendResult(res, await paymentService.receipt(String(req.org!.id), req.params.id));
  } catch (error) {
    next(error);
  }
};

export const share = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendResult(res, await paymentService.share(String(req.org!.id), req.params.id));
  } catch (error) {
    next(error);
  }
};

export const findByShareToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendResult(res, await paymentService.findByShareToken(req.params.token));
  } catch (error) {
    next(error);
  }
};

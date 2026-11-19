import { sendResult } from "../../shared/utils/apiResponse";
import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { ExpenseService } from "./expense.service";
import { createExpenseSchema, updateExpenseSchema, expenseQuerySchema } from "./expense.validation";

const expenseService = new ExpenseService();

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = createExpenseSchema.parse(req.body);
    const result = await expenseService.create(String(req.org!.id), body);
    sendResult(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const findAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = expenseQuerySchema.parse(req.query);
    const result = await expenseService.findAll(String(req.org!.id), query);
    sendResult(res, result);
  } catch (error) {
    next(error);
  }
};

export const findById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await expenseService.findById(String(req.org!.id), req.params.id);
    sendResult(res, result);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = updateExpenseSchema.parse(req.body);
    const result = await expenseService.update(String(req.org!.id), req.params.id, body);
    sendResult(res, result);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await expenseService.remove(String(req.org!.id), req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

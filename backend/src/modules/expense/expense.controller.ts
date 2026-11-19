import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { ExpenseService } from "./expense.service";
import { createExpenseSchema, updateExpenseSchema, expenseQuerySchema } from "./expense.validation";

const expenseService = new ExpenseService();

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = createExpenseSchema.parse(req.body);
    const result = await expenseService.create(req.user!.userId, body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const findAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = expenseQuerySchema.parse(req.query);
    const result = await expenseService.findAll(req.user!.userId, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const findById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await expenseService.findById(req.user!.userId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = updateExpenseSchema.parse(req.body);
    const result = await expenseService.update(req.user!.userId, req.params.id, body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await expenseService.remove(req.user!.userId, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

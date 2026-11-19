import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { InvoiceService } from "./invoice.service";
import { generateInvoiceSchema, generateForFlatSchema, invoiceQuerySchema, updateInvoiceSchema, updateStatusSchema } from "./invoice.validation";

const invoiceService = new InvoiceService();

export const generateInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = generateInvoiceSchema.parse(req.body);
    const result = await invoiceService.generateForOwner(req.user!.userId, body.month, body.year);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const generateAllInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { month, year } = generateInvoiceSchema.parse(req.body);
    const results = await invoiceService.generateAll(month, year);
    res.status(201).json(results);
  } catch (error) {
    next(error);
  }
};

export const findAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = invoiceQuerySchema.parse(req.query);
    const result = await invoiceService.findAll(req.user!.userId, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const findById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await invoiceService.findById(req.user!.userId, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const generateForFlat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = generateForFlatSchema.parse(req.body);
    const result = await invoiceService.generateForFlat(req.user!.userId, body.flatId, body.month, body.year, body.dryRun);
    res.status(body.dryRun ? 200 : 201).json(result);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await invoiceService.deleteInvoice(req.user!.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const result = await invoiceService.updateStatus(req.user!.userId, req.params.id, status);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = updateInvoiceSchema.parse(req.body);
    res.json(await invoiceService.update(req.user!.userId, req.params.id, body));
  } catch (error) {
    next(error);
  }
};

export const share = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await invoiceService.share(req.user!.userId, req.params.id));
  } catch (error) {
    next(error);
  }
};

export const findByShareToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await invoiceService.findByShareToken(req.params.token));
  } catch (error) {
    next(error);
  }
};

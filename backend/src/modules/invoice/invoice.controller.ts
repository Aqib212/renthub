import { sendResult } from "../../shared/utils/apiResponse";
import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { InvoiceService } from "./invoice.service";
import { generateInvoiceSchema, generateForFlatSchema, invoiceQuerySchema, updateInvoiceSchema, updateStatusSchema } from "./invoice.validation";

const invoiceService = new InvoiceService();

export const generateInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = generateInvoiceSchema.parse(req.body);
    const result = await invoiceService.generateForOrg(String(req.org!.id), body.month, body.year);
    sendResult(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const generateAllInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { month, year } = generateInvoiceSchema.parse(req.body);
    const results = await invoiceService.generateAll(month, year);
    sendResult(res, results, 201);
  } catch (error) {
    next(error);
  }
};

export const findAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = invoiceQuerySchema.parse(req.query);
    const result = await invoiceService.findAll(String(req.org!.id), query);
    sendResult(res, result);
  } catch (error) {
    next(error);
  }
};

export const findById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await invoiceService.findById(String(req.org!.id), req.params.id);
    sendResult(res, result);
  } catch (error) {
    next(error);
  }
};

export const generateForFlat = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = generateForFlatSchema.parse(req.body);
    const result = await invoiceService.generateForFlat(String(req.org!.id), body.flatId, body.month, body.year, body.dryRun);
    sendResult(res, result, body.dryRun ? 200 : 201);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await invoiceService.deleteInvoice(String(req.org!.id), req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const result = await invoiceService.updateStatus(String(req.org!.id), req.params.id, status);
    sendResult(res, result);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = updateInvoiceSchema.parse(req.body);
    sendResult(res, await invoiceService.update(String(req.org!.id), req.params.id, body));
  } catch (error) {
    next(error);
  }
};

export const share = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendResult(res, await invoiceService.share(String(req.org!.id), req.params.id));
  } catch (error) {
    next(error);
  }
};

export const findByShareToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendResult(res, await invoiceService.findByShareToken(req.params.token));
  } catch (error) {
    next(error);
  }
};

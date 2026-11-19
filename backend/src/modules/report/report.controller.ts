import { Response, NextFunction } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware";
import { ReportService } from "./report.service";
import { reportQuerySchema } from "./report.validation";

const reportService = new ReportService();

export const getReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = reportQuerySchema.parse(req.query);
    const data = await reportService.getReportData(req.user!.userId, query.type, query);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const downloadPDF = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = reportQuerySchema.parse(req.query);
    const pdf = await reportService.generatePDF(req.user!.userId, query.type, query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${query.type}_report.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
};

export const downloadExcel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = reportQuerySchema.parse(req.query);
    const excel = await reportService.generateExcel(req.user!.userId, query.type, query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${query.type}_report.xlsx"`);
    res.send(excel);
  } catch (error) {
    next(error);
  }
};

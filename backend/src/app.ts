import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { globalRateLimiter } from "./middleware/rateLimiter.middleware";
import { errorHandler } from "./middleware/errorHandler.middleware";
import authRoutes from "./modules/auth/auth.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import buildingRoutes from "./modules/building/building.routes";
import floorRoutes, { topLevelFloorRouter } from "./modules/floor/floor.routes";
import flatRoutes, { topLevelFlatRouter } from "./modules/flat/flat.routes";
import tenantRoutes, { topLevelTenantRouter } from "./modules/tenant/tenant.routes";
import billTypeRoutes, { billEntryRouter } from "./modules/bill-type/bill-type.routes";
import invoiceRoutes, { publicInvoiceRouter } from "./modules/invoice/invoice.routes";
import paymentRoutes from "./modules/payment/payment.routes";
import expenseRoutes from "./modules/expense/expense.routes";
import reportRoutes from "./modules/report/report.routes";
import { startScheduledTasks } from "./scheduledTasks";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/buildings", buildingRoutes);
app.use("/api/v1/buildings/:buildingId/floors", floorRoutes);
app.use("/api/v1/buildings/:buildingId/floors/:floorId/flats", flatRoutes);
app.use("/api/v1/buildings/:buildingId/floors/:floorId/flats/:flatId/tenants", tenantRoutes);
app.use("/api/v1/floors", topLevelFloorRouter);
app.use("/api/v1/flats", topLevelFlatRouter);
app.use("/api/v1/tenants", topLevelTenantRouter);
app.use("/api/v1/bill-types", billTypeRoutes);
app.use("/api/v1/bill-entries", billEntryRouter);
app.use("/api/v1/public/invoices", globalRateLimiter, publicInvoiceRouter);
app.use("/api/v1/invoices", invoiceRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/reports", reportRoutes);

app.get("/api/v1/health", (_req, res) => {
  res.json({ success: true, message: "Server is running", timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(env.port, () => {
  startScheduledTasks();
console.log(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
});

export default app;

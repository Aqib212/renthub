import cron from "node-cron";
import { InvoiceService } from "./modules/invoice/invoice.service";

const invoiceService = new InvoiceService();

export function startScheduledTasks() {
  cron.schedule("0 0 1 * *", async () => {
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();

    console.log(`[Cron] Auto-generating invoices for ${month}/${year}`);
    try {
      const results = await invoiceService.generateAll(month, year);
      const totalGenerated = results.reduce((s, r) => s + r.generated, 0);
      console.log(`[Cron] Generated ${totalGenerated} invoices across ${results.length} owners`);
    } catch (error) {
      console.error("[Cron] Invoice generation failed:", error);
    }
  });

  console.log("[Cron] Scheduled tasks initialized");
}

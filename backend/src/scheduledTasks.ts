import cron from "node-cron";
import { prisma } from "./shared/prisma";
import { InvoiceService } from "./modules/invoice/invoice.service";
import { drain, queueDailyReminders, queueExpiryReminders } from "./modules/notification/notification.service";
import { todayBd } from "./modules/vehicle/vehicle.service";

const invoiceService = new InvoiceService();

/** Rent is billed in advance: the invoice made on the 1st is for the current month (utilities on it are last month's usage). */
export const billingMonthFor = (now: Date) => ({ month: now.getMonth() + 1, year: now.getFullYear() });

export function startScheduledTasks() {
  cron.schedule("0 0 1 * *", async () => {
    const { month, year } = billingMonthFor(new Date());
    console.log(`[Cron] Auto-generating invoices for ${month}/${year}`);
    try {
      const results = await invoiceService.generateAll(month, year);
      const totalGenerated = results.reduce((s, r) => s + r.generated, 0);
      console.log(`[Cron] Generated ${totalGenerated} invoices across ${results.length} owners`);
    } catch (error) {
      console.error("[Cron] Invoice generation failed:", error);
    }
  });

  // Status is otherwise only recomputed when a payment changes, so unpaid invoices never turned OVERDUE.
  cron.schedule("30 0 * * *", async () => {
    try {
      const { count } = await prisma.invoice.updateMany({
        // same precedence as statusFor(): a part-paid invoice stays PARTIALLY_PAID
        where: { status: "PENDING", dueDate: { lt: new Date() }, dueAmount: { gt: 0 }, carriedForward: false },
        data: { status: "OVERDUE" },
      });
      if (count) console.log(`[Cron] Marked ${count} invoices overdue`);
    } catch (error) {
      console.error("[Cron] Overdue update failed:", error);
    }
  });

  // outbox: send queued SMS every minute
  let draining = false;
  cron.schedule("* * * * *", async () => {
    if (draining) return; // a slow gateway must not start a second drain
    draining = true;
    try {
      await drain();
    } catch (error) {
      console.error("[Cron] SMS drain failed:", error);
    } finally {
      draining = false;
    }
  });

  // rent reminders: the 5th, the due day and 3 days after (per organisation settings)
  cron.schedule("0 9 * * *", async () => {
    try {
      const { queued } = await queueDailyReminders();
      if (queued) console.log(`[Cron] Queued ${queued} rent reminders`);
    } catch (error) {
      console.error("[Cron] Reminders failed:", error);
    }
    try {
      const { queued } = await queueExpiryReminders(new Date(`${todayBd()}T00:00:00.000Z`));
      if (queued) console.log(`[Cron] Queued ${queued} document expiry reminders`);
    } catch (error) {
      console.error("[Cron] Expiry reminders failed:", error);
    }
  });

  console.log("[Cron] Scheduled tasks initialized");
}

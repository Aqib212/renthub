import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Card, Link, MenuItem, Pagination, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { auditApi, type AuditRow } from "@/api/audit";
import { useT } from "@/i18n";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "activity.all" },
  { value: "payment", label: "Payments" },
  { value: "invoice", label: "Invoices" },
  { value: "agreement", label: "Agreements" },
  { value: "cash", label: "Cash handover" },
  { value: "billing", label: "Building bills" },
  { value: "maintenance", label: "Maintenance" },
  { value: "member", label: "Staff" },
  { value: "document", label: "Documents" },
  { value: "claim", label: "Portal payments" },
  { value: "notice", label: "Move-out requests" },
  { value: "jama", label: "Jama off days" },
  { value: "booking", label: "Bookings" },
  { value: "admin", label: "RentHub account" },
  { value: "support", label: "Support visits" },
];

/** Plain-English line for an audit row; the raw metadata is shown beside it. */
const describe = (r: AuditRow) => {
  const m = (r.metadata ?? {}) as Record<string, any>;
  const tk = (n: unknown) => `৳${Number(n ?? 0).toLocaleString("en-IN")}`;
  switch (r.action) {
    case "payment.create": return `Recorded ${tk(m.amount)} (${m.method}) · ${m.receiptNo ?? ""}`;
    case "payment.update": return `Changed payment ${m.receiptNo ?? ""}: ${tk(m.before?.amount)} → ${tk(m.after?.amount)}`;
    case "payment.delete": return `Deleted payment ${m.receiptNo ?? ""} of ${tk(m.amount)}`;
    case "invoice.generate": return `Generated ${m.generated} invoice(s) for ${m.month}/${m.year}`;
    case "invoice.update": return `Edited invoice ${m.period}`;
    case "invoice.delete": return `Deleted invoice ${m.period} (${tk(m.total)})`;
    case "agreement.create": return `New agreement for ${m.unit} at ${tk(m.rate)}`;
    case "agreement.activate": return "Activated agreement";
    case "agreement.revision": return `Rent ${tk(m.from)} → ${tk(m.to)} from ${m.effectiveFrom}`;
    case "agreement.deposit": return `Deposit ${String(m.type).toLowerCase()} ${tk(m.amount)}`;
    case "agreement.notice": return `Notice given; ends ${m.endDate}`;
    case "agreement.end": return `Moved out on ${m.endDate}${m.refunded ? `, refunded ${tk(m.refunded)}` : ""}`;
    case "agreement.update": return "Changed agreement terms";
    case "cash.handover": return `Cash handover of ${tk(m.amount)} (${m.payments} payments)`;
    case "billing.building_bill": return `${m.billType} for ${m.building}, ${m.month}/${m.year}: ${tk(m.total)} over ${m.units} units`;
    case "member.add": return `Added ${m.email} as ${m.role}`;
    case "member.update": return "Changed a staff member";
    case "member.remove": return "Removed a staff member";
    case "document.delete": return `Deleted document "${m.name}"`;
    case "claim.submit": return `Reported ${tk(m.amount)} paid by ${m.method} (${m.transactionId})`;
    case "claim.confirm": return `Confirmed a reported payment of ${tk(m.amount)} (${m.transactionId})`;
    case "claim.reject": return `Rejected a reported payment (${m.transactionId}): ${m.reason}`;
    case "notice.request": return `Asked to move out on ${m.moveOutDate}`;
    case "notice.withdraw": return "Withdrew the move-out request";
    case "notice.accepted": return `Accepted the tenant's notice (leaving ${m.moveOutDate})`;
    case "notice.declined": return `Declined the tenant's notice${m.note ? `: ${m.note}` : ""}`;
    case "jama.day_set": return `${m.vehicle ?? "Vehicle"} ${m.date}: ${Number(m.amount) === 0 ? "off day" : `jama ${tk(m.amount)}`}${m.reason ? ` (${m.reason})` : ""}`;
    case "booking.create": return `Booked ${m.vehicle} ${m.from}${m.to !== m.from ? ` to ${m.to}` : ""} at ${tk(m.dayRate)}/day`;
    case "booking.update": return `Changed the booking of ${m.vehicle}`;
    case "booking.start": return `${m.vehicle} left on a trip (${m.startKm} km)`;
    case "booking.close": return `${m.vehicle} back from a trip${m.km != null ? ` (${m.km} km)` : ""}`;
    case "booking.cancel": return `Cancelled the booking of ${m.vehicle}${m.charge ? `, charge ${tk(m.charge)}` : ""}`;
    case "support.open": return "RentHub support opened this workspace (read-only)";
    case "admin.plan": return `RentHub changed the plan: ${Object.entries(m.after ?? {}).map(([k, v]) => `${k} ${v ?? "none"}`).join(", ")}`;
    case "admin.credits": return `RentHub ${Number(m.amount) > 0 ? "added" : "removed"} ${Math.abs(Number(m.amount))} SMS credits (${m.reason})`;
    case "admin.suspend": return "RentHub suspended this workspace";
    case "admin.reactivate": return "RentHub reactivated this workspace";
    case "jama.day_clear": return `${m.vehicle ?? "Vehicle"} ${m.date}: back to normal jama`;
    default:
      if (r.action.startsWith("maintenance.")) return `Maintenance: ${m.title ?? ""} ${r.action.split(".")[1]}${m.cost ? ` (${tk(m.cost)})` : ""}`;
      return r.action;
  }
};

const linkFor = (r: AuditRow) =>
  r.entity === "Agreement" && r.entityId ? `/agreements/${r.entityId}`
  : r.entity === "Payment" && r.entityId && r.action !== "payment.delete" ? `/payments/${r.entityId}/receipt`
  : r.entity === "Invoice" && r.entityId && r.action !== "invoice.delete" ? `/invoices/${r.entityId}/print`
  : r.entity === "MaintenanceRequest" ? "/maintenance"
  : r.entity === "Booking" && r.entityId ? `/bookings/${r.entityId}`
  : null;

export const ActivityPage = () => {
  const { t, lang } = useT();
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ["audit", action, page], queryFn: () => auditApi.list({ action: action || undefined, page, limit: 50 }) });

  return (
    <Box>
      <PageHeader title={t("activity.title")} subtitle={t("activity.subtitle")} />
      <Stack direction="row" sx={{ mb: 2 }}>
        <TextField select size="small" label={t("activity.filter")} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} sx={{ minWidth: 200 }}>
          {FILTERS.map((f) => <MenuItem key={f.value} value={f.value}>{f.value ? f.label : t("activity.all")}</MenuItem>)}
        </TextField>
      </Stack>
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("activity.when")}</TableCell>
                <TableCell>{t("activity.who")}</TableCell>
                <TableCell>{t("activity.what")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.data.map((r) => {
                const to = linkFor(r);
                return (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {new Date(r.createdAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{r.user ? `${r.user.firstName} ${r.user.lastName}` : r.tenant ? `${r.tenant.firstName} ${r.tenant.lastName} (tenant)` : "–"}</TableCell>
                    <TableCell>
                      {to ? <Link component={RouterLink} to={to}>{describe(r)}</Link> : describe(r)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {data && !data.data.length && (
                <TableRow><TableCell colSpan={3}><Typography color="text.secondary">{t("activity.empty")}</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      {(data?.meta.totalPages ?? 0) > 1 && (
        <Pagination sx={{ mt: 2 }} count={data!.meta.totalPages} page={page} onChange={(_, p) => setPage(p)} />
      )}
    </Box>
  );
};

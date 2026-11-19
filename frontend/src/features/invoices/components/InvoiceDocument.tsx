import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, GlobalStyles } from "@mui/material";
import dayjs from "dayjs";
import type { InvoiceDetail } from "@/types/invoice";
import { MONTH_NAMES } from "@/types/invoice";
import { formatBDT } from "@/utils/format";

const STAMP: Record<string, { text: string; color: string }> = {
  PAID: { text: "PAID", color: "#16a34a" },
  PARTIALLY_PAID: { text: "PARTIALLY PAID", color: "#2563eb" },
  OVERDUE: { text: "OVERDUE", color: "#dc2626" },
  PENDING: { text: "DUE", color: "#d97706" },
};

const ink = "#0f172a";
const muted = "#64748b";
const line = "#e2e8f0";
const accent = "#0f766e";

/** A4 print styles: only the invoice sheet is printed. */
export const InvoicePrintStyles = () => (
  <GlobalStyles
    styles={{
      "@page": { size: "A4", margin: "12mm" },
      "@media print": {
        "body *": { visibility: "hidden" },
        ".invoice-sheet, .invoice-sheet *": { visibility: "visible" },
        ".invoice-sheet": { position: "absolute", left: 0, top: 0, width: "100%", boxShadow: "none !important", border: "none !important", padding: "0 !important" },
        body: { background: "#fff !important", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" },
      },
    }}
  />
);

export const InvoiceDocument = ({ invoice }: { invoice: InvoiceDetail }) => {
  const stamp = invoice.carriedForward ? { text: "CARRIED FORWARD", color: muted } : STAMP[invoice.status];
  const subtotal = invoice.items.reduce((s, it) => s + Number(it.amount), 0);
  const address = [invoice.building.address, invoice.building.area, invoice.building.district].filter(Boolean).join(", ");
  const period = `${MONTH_NAMES[invoice.month - 1]} ${invoice.year}`;

  const sumRow = (label: string, value: string, opts: { strong?: boolean; color?: string; big?: boolean } = {}) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.6, color: opts.color ?? ink }}>
      <Typography sx={{ fontSize: opts.big ? 15 : 13, fontWeight: opts.strong ? 700 : 400, color: "inherit" }}>{label}</Typography>
      <Typography sx={{ fontSize: opts.big ? 17 : 13, fontWeight: opts.strong ? 700 : 500, color: "inherit", fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </Box>
  );

  return (
    <Box
      className="invoice-sheet"
      sx={{
        bgcolor: "#fff", color: ink, width: "100%", maxWidth: 794, mx: "auto", p: { xs: 3, sm: 5 },
        border: `1px solid ${line}`, borderRadius: 2, position: "relative", overflow: "hidden",
        "& .MuiTableCell-root": { borderColor: line, px: 1.25 },
      }}
    >
      <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, bgcolor: accent }} />

      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 3, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1.2 }}>{invoice.building.name}</Typography>
          {address && <Typography sx={{ fontSize: 13, color: muted, mt: 0.5 }}>{address}</Typography>}
          {invoice.building.holdingNumber && <Typography sx={{ fontSize: 13, color: muted }}>Holding: {invoice.building.holdingNumber}</Typography>}
          <Typography sx={{ fontSize: 13, mt: 1 }}>
            Owner: <b>{invoice.owner.name}</b>{invoice.owner.phone ? ` · ${invoice.owner.phone}` : ""}
          </Typography>
        </Box>
        <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
          <Typography sx={{ fontSize: 28, fontWeight: 800, letterSpacing: "0.12em", lineHeight: 1 }}>INVOICE</Typography>
          <Typography sx={{ fontSize: 13, color: muted, mt: 1 }}>{invoice.invoiceNo}</Typography>
          <Typography sx={{ fontSize: 13 }}>Billing month: <b>{period}</b></Typography>
          <Typography sx={{ fontSize: 13 }}>Issued: {dayjs(invoice.createdAt).format("DD MMM YYYY")}</Typography>
          {invoice.dueDate && <Typography sx={{ fontSize: 13 }}>Due by: <b>{dayjs(invoice.dueDate).format("DD MMM YYYY")}</b></Typography>}
        </Box>
      </Box>

      {/* Billed to */}
      <Box sx={{ mt: 3.5, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 1.5, border: `1px solid ${line}` }}>
          <Typography sx={{ fontSize: 11, color: muted, fontWeight: 600, letterSpacing: "0.08em" }}>BILLED TO</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mt: 0.5 }}>{invoice.tenant?.name ?? "—"}</Typography>
          {invoice.tenant?.phone && <Typography sx={{ fontSize: 13, color: muted }}>{invoice.tenant.phone}</Typography>}
        </Box>
        <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 1.5, border: `1px solid ${line}` }}>
          <Typography sx={{ fontSize: 11, color: muted, fontWeight: 600, letterSpacing: "0.08em" }}>PROPERTY</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mt: 0.5 }}>
            Flat {invoice.flat.name}{invoice.flat.flatNumber && invoice.flat.flatNumber !== invoice.flat.name ? ` (${invoice.flat.flatNumber})` : ""}
          </Typography>
          <Typography sx={{ fontSize: 13, color: muted }}>{invoice.flat.floorName}, {invoice.building.name}</Typography>
        </Box>
      </Box>

      {/* Items */}
      <Table size="small" sx={{ mt: 3 }}>
        <TableHead>
          <TableRow sx={{ "& th": { bgcolor: `${accent} !important`, color: "#fff !important", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" } }}>
            <TableCell width={36}>#</TableCell>
            <TableCell>DESCRIPTION</TableCell>
            <TableCell align="right" width={140}>AMOUNT</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoice.items.map((it, i) => (
            <TableRow key={it.id ?? i} sx={{ "& td": { fontSize: 13, py: 1.1 } }}>
              <TableCell sx={{ color: muted }}>{i + 1}</TableCell>
              <TableCell>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{it.label}</Typography>
                {it.detail && <Typography sx={{ fontSize: 11.5, color: muted }}>{it.detail}</Typography>}
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatBDT(it.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Totals + stamp */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mt: 2, gap: 3, flexWrap: "wrap-reverse" }}>
        <Box sx={{ flex: "1 1 220px", pt: 1 }}>
          {stamp && (
            <Box
              sx={{
                display: "inline-block", border: `3px solid ${stamp.color}`, color: stamp.color, borderRadius: 1.5,
                px: 2, py: 0.75, fontWeight: 800, fontSize: 20, letterSpacing: "0.12em", transform: "rotate(-8deg)", opacity: 0.85, mt: 1, ml: 1,
              }}
            >
              {stamp.text}
            </Box>
          )}
          {invoice.carriedForward && (
            <Typography sx={{ fontSize: 12, color: muted, mt: 2 }}>
              The unpaid balance of this invoice was added to the next month's invoice as "Previous due".
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: "0 1 300px", width: "100%" }}>
          {sumRow("Subtotal", formatBDT(subtotal))}
          {Number(invoice.previousDue) > 0 && sumRow("Previous due", formatBDT(invoice.previousDue))}
          {Number(invoice.discount) > 0 && sumRow("Discount", `− ${formatBDT(invoice.discount)}`, { color: "#16a34a" })}
          {Number(invoice.fine) > 0 && sumRow("Late fine", formatBDT(invoice.fine))}
          <Box sx={{ borderTop: `1px solid ${line}`, mt: 0.5, pt: 0.5 }}>{sumRow("Total", formatBDT(invoice.totalAmount), { strong: true })}</Box>
          {sumRow("Paid", formatBDT(invoice.paidAmount), { color: "#16a34a" })}
          <Box sx={{ mt: 1, px: 1.5, py: 1, borderRadius: 1.5, bgcolor: Number(invoice.dueAmount) > 0 ? "#fef2f2" : "#f0fdf4" }}>
            {sumRow("Balance due", formatBDT(invoice.dueAmount), { strong: true, big: true, color: Number(invoice.dueAmount) > 0 ? "#b91c1c" : "#15803d" })}
          </Box>
        </Box>
      </Box>

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <Box sx={{ mt: 3.5 }}>
          <Typography sx={{ fontSize: 11, color: muted, fontWeight: 600, letterSpacing: "0.08em", mb: 1 }}>PAYMENTS RECEIVED</Typography>
          <Table size="small">
            <TableBody>
              {invoice.payments.map((p) => (
                <TableRow key={p.id} sx={{ "& td": { fontSize: 12.5, py: 0.75 } }}>
                  <TableCell>{dayjs(p.date).format("DD MMM YYYY")}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell sx={{ color: muted }}>{p.transactionId || p.collector || ""}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatBDT(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {invoice.notes && (
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: 11, color: muted, fontWeight: 600, letterSpacing: "0.08em" }}>NOTES</Typography>
          <Typography sx={{ fontSize: 13, whiteSpace: "pre-wrap", mt: 0.5 }}>{invoice.notes}</Typography>
        </Box>
      )}

      {/* Footer */}
      <Box sx={{ mt: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 3, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: 11.5, color: muted, maxWidth: 380 }}>
          Please pay by the due date. This is a computer-generated invoice and is valid without a signature.
          Keep it as proof of your monthly charges.
        </Typography>
        <Box sx={{ textAlign: "center", minWidth: 180 }}>
          <Box sx={{ borderTop: `1px solid ${ink}`, pt: 0.5 }}>
            <Typography sx={{ fontSize: 12 }}>Authorized signature</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

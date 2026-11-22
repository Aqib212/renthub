import { Box, Stack, Typography } from "@mui/material";
import type { Receipt } from "@/api/collections";
import { translate, type Lang } from "@/i18n";
import { formatBDT, formatDate, toBnDigits } from "@/utils/format";

const line = "#DDE2DE";
const muted = "#55615B";

/** Printable money receipt (A5-ish). Language is the tenant's unless the viewer switches. */
export const ReceiptDocument = ({ receipt: r, lang }: { receipt: Receipt; lang: Lang }) => {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  const n = (s: string | number) => (lang === "bn" ? toBnDigits(s) : String(s));
  const row = (label: string, value: React.ReactNode, strong = false) => (
    <Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 1, borderBottom: `1px solid ${line}` }}>
      <Typography sx={{ fontSize: 14, color: muted }}>{label}</Typography>
      <Typography sx={{ fontSize: strong ? 18 : 14, fontWeight: strong ? 800 : 600, textAlign: "right" }}>{value}</Typography>
    </Stack>
  );

  return (
    <Box sx={{ maxWidth: 620, mx: "auto", bgcolor: "#fff", border: `1px solid ${line}`, borderRadius: 2, p: { xs: 2.5, sm: 4 }, "@media print": { border: 0, p: 0 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 20 }}>{r.owner.name}</Typography>
          {r.building && <Typography sx={{ fontSize: 13, color: muted }}>{r.building.name}{r.building.address ? `, ${r.building.address}` : ""}</Typography>}
          {r.owner.phone && <Typography sx={{ fontSize: 13, color: muted }}>{n(r.owner.phone)}</Typography>}
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 18, color: "#0B5D46" }}>{t("rcp.title")}</Typography>
          <Typography sx={{ fontSize: 13 }}>{t("rcp.no")}: <b>{r.receiptNo ?? "–"}</b></Typography>
          <Typography sx={{ fontSize: 13 }}>{t("common.date")}: {formatDate(r.date, lang)}</Typography>
        </Box>
      </Stack>

      {row(t("rcp.receivedFrom"), r.tenant?.name ?? "–")}
      {row(t("rcp.forUnit"), r.unit.floorName ? `${r.unit.name}, ${r.unit.floorName}` : r.unit.name)}
      {row(t("rcp.forInvoice"), `${r.invoice.invoiceNo} (${n(String(r.invoice.month).padStart(2, "0"))}/${n(r.invoice.year)})`)}
      {row(t("rcp.method"), `${t(`method.${r.method}` as any)}${r.transactionId ? ` · ${r.transactionId}` : ""}`)}
      {row(t("rcp.amount"), formatBDT(r.amount, lang), true)}
      <Typography sx={{ fontSize: 13, color: muted, py: 1, borderBottom: `1px solid ${line}` }}>{t("rcp.inWords")}: {r.amountInWords}</Typography>
      {row(t("rcp.balance"), formatBDT(r.invoice.dueAmount, lang))}
      {r.collectorName && row(t("rcp.collectedBy"), r.collectorName)}

      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 4 }}>
        <Typography sx={{ fontSize: 12, color: muted, maxWidth: 320 }}>{t("rcp.thanks")}</Typography>
        <Box sx={{ textAlign: "center" }}>
          <Box sx={{ borderTop: `1px solid ${muted}`, width: 160, mb: 0.5 }} />
          <Typography sx={{ fontSize: 12 }}>{t("inv.signature")}</Typography>
        </Box>
      </Stack>
    </Box>
  );
};

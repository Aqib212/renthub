import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Chip, List, ListItem, ListItemText, MenuItem, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { portalApi } from "@/api/portal";
import { useT } from "@/i18n";
import { formatBDT, formatDate } from "@/utils/format";
import { CHIP } from "@/theme";
import { monthLabel, usePortalHome } from "./PortalLayout";

const STATUS_TONE: Record<string, { bg: string; fg: string }> = { PAID: CHIP.ok, PARTIALLY_PAID: CHIP.warning, OVERDUE: CHIP.error, PENDING: CHIP.info };

export const PortalBillsPage = () => {
  const { t, lang } = useT();
  const { data: home } = usePortalHome();
  const [picked, setPicked] = useState<number | null>(null);
  const [tab, setTab] = useState<"bills" | "receipts">("bills");
  const agreementId = picked ?? home?.tenancies[0]?.agreementId ?? 0;

  const { data: bills = [] } = useQuery({ queryKey: ["portal", "bills", agreementId], queryFn: () => portalApi.invoices(agreementId), enabled: !!agreementId });
  const { data: receipts = [] } = useQuery({ queryKey: ["portal", "receipts", agreementId], queryFn: () => portalApi.payments(agreementId), enabled: !!agreementId });

  return (
    <Stack spacing={2}>
      {(home?.tenancies.length ?? 0) > 1 && (
        <TextField select size="small" value={agreementId} onChange={(e) => setPicked(Number(e.target.value))}>
          {home!.tenancies.map((x) => <MenuItem key={x.agreementId} value={x.agreementId}>{x.unit ? `${x.unit.name}, ${x.unit.building.name}` : x.org.name}</MenuItem>)}
        </TextField>
      )}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
        <Tab value="bills" label={t("portal.bills")} />
        <Tab value="receipts" label={t("portal.receipts")} />
      </Tabs>
      <Card>
        {tab === "bills" ? (
          <List disablePadding>
            {!bills.length && <ListItem><ListItemText secondary={t("portal.noBills")} /></ListItem>}
            {bills.map((b) => {
              const status = b.carriedForward ? "CARRIED" : b.status;
              const tone = STATUS_TONE[b.status] ?? CHIP.muted;
              return (
                <ListItem key={b.id} divider secondaryAction={b.shareToken && <Button size="small" component={RouterLink} to={`/i/${b.shareToken}`}>{t("portal.open")}</Button>}>
                  <ListItemText
                    primary={<Stack direction="row" spacing={1} alignItems="center"><span>{monthLabel(b.month, b.year, lang)}</span>
                      <Chip size="small" sx={{ bgcolor: tone.bg, color: tone.fg }} label={t(`inv.stamp.${status}` as any)} /></Stack>}
                    secondary={`${formatBDT(b.totalAmount, lang)}${b.dueAmount > 0 && !b.carriedForward ? ` · ${t("inv.balanceDue")} ${formatBDT(b.dueAmount, lang)}` : ""}`}
                  />
                </ListItem>
              );
            })}
          </List>
        ) : (
          <List disablePadding>
            {!receipts.length && <ListItem><ListItemText secondary={t("portal.noReceipts")} /></ListItem>}
            {receipts.map((p) => (
              <ListItem key={p.id} divider secondaryAction={p.shareToken && <Button size="small" component={RouterLink} to={`/r/${p.shareToken}`}>{t("portal.open")}</Button>}>
                <ListItemText
                  primary={`${formatBDT(p.amount, lang)} · ${t(`method.${p.method}` as any)}`}
                  secondary={`${formatDate(p.date, lang)} · ${p.receiptNo ?? ""} · ${monthLabel(p.invoice.month, p.invoice.year, lang)}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Card>
      {!home?.tenancies.length && <Typography color="text.secondary">{t("portal.noTenancy")}</Typography>}
    </Stack>
  );
};

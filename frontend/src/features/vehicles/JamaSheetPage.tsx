import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Link, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { ChevronLeft, ChevronRight, EventBusyOutlined } from "@mui/icons-material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaymentFormDialog } from "@/features/payments/components/PaymentFormDialog";
import { jamaApi, type JamaRow } from "@/api/vehicles";
import { useCurrentMembership } from "@/store/authStore";
import { useT } from "@/i18n";
import { apiError, formatBDT } from "@/utils/format";
import { CHIP } from "@/theme";

/** Today in Bangladesh, YYYY-MM-DD. */
export const todayBd = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
const shift = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** Off day or a different jama for one day (OWNER / MANAGER). */
const DayDialog = ({ row, date, onClose }: { row: JamaRow | null; date: string; onClose: () => void }) => {
  const { t } = useT();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [forRow, setForRow] = useState<number | null>(null);
  if (row && forRow !== row.agreementId) {
    setForRow(row.agreementId);
    setAmount(String(row.entry?.amount ?? 0));
    setReason(row.entry?.reason ?? "");
  }
  const done = (r: unknown) => { qc.setQueryData(["jama", date], r); qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success(t("jama.saved")); setForRow(null); onClose(); };
  const save = useMutation({ mutationFn: () => jamaApi.setDay({ agreementId: row!.agreementId, date, amount: Number(amount) || 0, reason: reason || null }), onSuccess: done, onError: (e) => toast.error(apiError(e)) });
  const clear = useMutation({ mutationFn: () => jamaApi.clearDay(row!.entry!.id), onSuccess: done, onError: (e) => toast.error(apiError(e)) });

  return (
    <Dialog open={!!row} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{row?.vehicle.regNo} · {row?.driver.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label={t("jama.amount")} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} helperText={t("jama.amountHint", { rate: formatBDT(row?.rate ?? 0) })} />
          <TextField label={t("jama.reason")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("jama.reasonHint")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {row?.entry && <Button color="inherit" onClick={() => clear.mutate()} disabled={clear.isPending}>{t("jama.clear")}</Button>}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>{t("portal.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>{t("jama.save")}</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Today's jama: the caretaker collects each driver's daily amount; owners mark off days. Works on a phone. */
export const JamaSheetPage = () => {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const role = useCurrentMembership()?.role;
  const canWaive = role === "OWNER" || role === "MANAGER";
  const canCollect = canWaive || role === "CARETAKER" || role === "ACCOUNTANT";
  const [date, setDate] = useState(todayBd());
  const [dayRow, setDayRow] = useState<JamaRow | null>(null);
  const [collect, setCollect] = useState<{ invoiceId: number; amount: number } | null>(null);
  const { data } = useQuery({ queryKey: ["jama", date], queryFn: () => jamaApi.sheet(date) });
  const money = (n: number) => formatBDT(n, lang);

  const open = useMutation({
    mutationFn: (r: JamaRow) => (r.invoiceId ? Promise.resolve({ invoiceId: r.invoiceId }) : jamaApi.open(r.agreementId, date)).then((x) => ({ ...x, amount: Math.max(0, Math.min(r.jama - r.paidToday, r.owed)) || r.jama })),
    onSuccess: (x) => setCollect(x),
    onError: (e) => toast.error(apiError(e)),
  });

  const totals = data?.totals;
  return (
    <Box>
      <PageHeader title={t("jama.title")} subtitle={t("jama.subtitle")} />
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton aria-label={t("jama.prev")} onClick={() => setDate(shift(date, -1))}><ChevronLeft /></IconButton>
        <TextField type="date" size="small" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} inputProps={{ max: todayBd() }} />
        <IconButton aria-label={t("jama.next")} onClick={() => setDate(shift(date, 1))} disabled={date >= todayBd()}><ChevronRight /></IconButton>
        {date !== todayBd() && <Button size="small" onClick={() => setDate(todayBd())}>{t("jama.today")}</Button>}
      </Stack>

      {totals && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5, mb: 2 }}>
          {[
            [t("jama.expected"), totals.expected, "text.primary"],
            [t("jama.collected"), totals.collected, "success.main"],
            [t("jama.totalOwed"), totals.owed, totals.owed > 0 ? "error.main" : "text.primary"],
          ].map(([label, value, color]) => (
            <Card key={label as string}>
              <CardContent sx={{ p: { xs: 1.5, sm: 2 }, "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
                <Typography fontSize={12} color="text.secondary">{label}</Typography>
                <Typography fontWeight={700} fontSize={{ xs: 16, sm: 20 }} color={color as string} sx={{ fontVariantNumeric: "tabular-nums" }}>{money(value as number)}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Stack spacing={1.5}>
        {data?.rows.map((r) => {
          const off = r.entry?.amount === 0;
          const paid = r.paidToday >= r.jama && r.jama > 0;
          return (
            <Card key={r.agreementId}>
              <CardContent sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, "&:last-child": { pb: 2 } }}>
                <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
                  <Link component={RouterLink} to={`/vehicles/${r.vehicle.id}`} fontWeight={700} underline="hover">{r.vehicle.regNo}</Link>
                  <Typography fontSize={14}>
                    <Link component={RouterLink} to={`/agreements/${r.agreementId}`} color="inherit" underline="hover">{r.driver.name}</Link>
                    {r.driver.phone && <Typography component="span" color="text.secondary" fontSize={13}> · <a href={`tel:${r.driver.phone}`} style={{ color: "inherit" }}>{r.driver.phone}</a></Typography>}
                  </Typography>
                  {r.entry?.reason && <Typography fontSize={12} color="text.secondary">{r.entry.reason}</Typography>}
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", columnGap: 2.5, textAlign: "right" }}>
                  <Typography fontSize={11} color="text.secondary">{t("jama.jama")}</Typography>
                  <Typography fontSize={11} color="text.secondary">{t("jama.paid")}</Typography>
                  <Typography fontSize={11} color="text.secondary">{t("jama.owed")}</Typography>
                  <Typography fontWeight={600}>{off ? <Chip size="small" label={t("jama.off")} sx={{ bgcolor: CHIP.muted.bg, color: CHIP.muted.fg }} /> : money(r.jama)}</Typography>
                  <Typography fontWeight={600} color={paid ? "success.main" : undefined}>{money(r.paidToday)}</Typography>
                  <Typography fontWeight={600} color={r.owed > 0 ? "error.main" : undefined}>{money(r.owed)}</Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
                  {canWaive && (
                    <Tooltip title={t("jama.offDay")}>
                      <IconButton aria-label={t("jama.offDay")} onClick={() => setDayRow(r)}><EventBusyOutlined /></IconButton>
                    </Tooltip>
                  )}
                  {canCollect && (
                    <Button variant={paid ? "outlined" : "contained"} onClick={() => open.mutate(r)} disabled={open.isPending || (r.owed <= 0 && r.jama === 0)}>{t("jama.collect")}</Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
        {data && !data.rows.length && <Typography color="text.secondary">{t("jama.empty")}</Typography>}
      </Stack>

      <DayDialog row={dayRow} date={date} onClose={() => setDayRow(null)} />
      <PaymentFormDialog
        open={!!collect}
        onClose={() => setCollect(null)}
        preselectedInvoiceId={collect?.invoiceId}
        presetAmount={collect?.amount}
        presetDate={date}
        onSaved={() => qc.invalidateQueries({ queryKey: ["jama"] })}
      />
    </Box>
  );
};

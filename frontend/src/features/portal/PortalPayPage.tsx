import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import toast from "react-hot-toast";
import { portalApi, type ClaimMethod } from "@/api/portal";
import { useT } from "@/i18n";
import { apiError, formatBDT } from "@/utils/format";
import { monthLabel, usePortalHome } from "./PortalLayout";

const METHODS: ClaimMethod[] = ["BKASH", "NAGAD", "ROCKET", "BANK", "CHEQUE"];

/** "I paid by bKash": the tenant reports a payment made outside the app; the owner confirms it. */
export const PortalPayPage = () => {
  const { agreementId, invoiceId } = useParams();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: home } = usePortalHome();
  const tenancy = home?.tenancies.find((x) => String(x.agreementId) === agreementId);
  const { data: bills = [] } = useQuery({ queryKey: ["portal", "bills", Number(agreementId)], queryFn: () => portalApi.invoices(Number(agreementId)) });
  const bill = bills.find((b) => String(b.id) === invoiceId);

  const [form, setForm] = useState({ method: "BKASH" as ClaimMethod, amount: "", transactionId: "", paidOn: new Date().toISOString().slice(0, 10), note: "" });
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const amount = form.amount || (bill ? String(bill.dueAmount) : "");

  const send = useMutation({
    mutationFn: () => portalApi.claim({ invoiceId: Number(invoiceId), amount: Number(amount), method: form.method, transactionId: form.transactionId.trim(), paidOn: form.paidOn, note: form.note || undefined }),
    onSuccess: () => {
      toast.success(t("portal.claimSent"));
      qc.invalidateQueries({ queryKey: ["portal"] });
      navigate("/portal");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontSize: 22 }}>{t("portal.payTitle")}</Typography>
      {bill && (
        <Typography color="text.secondary">
          {t("portal.billFor", { month: monthLabel(bill.month, bill.year, lang) })} · {t("inv.balanceDue")} {formatBDT(bill.dueAmount, lang)}
        </Typography>
      )}
      <Card>
        <CardContent>
          <Typography variant="h6" fontSize={16} sx={{ mb: 1 }}>{t("portal.payTo")}</Typography>
          <Typography sx={{ whiteSpace: "pre-line" }} color={tenancy?.org.payInfo ? "text.primary" : "text.secondary"}>
            {tenancy?.org.payInfo || t("portal.payToNone")}
          </Typography>
        </CardContent>
      </Card>
      <Alert severity="info">{t("portal.payHelp")}</Alert>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
        <Stack spacing={2}>
          <TextField select label={t("portal.method")} value={form.method} onChange={(e) => set({ method: e.target.value as ClaimMethod })}>
            {METHODS.map((m) => <MenuItem key={m} value={m}>{t(`method.${m}`)}</MenuItem>)}
          </TextField>
          <TextField label={t("portal.amount")} type="number" required value={amount} onChange={(e) => set({ amount: e.target.value })}
            inputProps={{ inputMode: "decimal", min: 1 }} InputProps={{ startAdornment: <InputAdornment position="start">৳</InputAdornment> }} />
          <TextField label={t("portal.txn")} required value={form.transactionId} onChange={(e) => set({ transactionId: e.target.value })} helperText={t("portal.txnHelp")} />
          <TextField label={t("portal.paidOn")} type="date" required value={form.paidOn} onChange={(e) => set({ paidOn: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField label={t("portal.note")} value={form.note} onChange={(e) => set({ note: e.target.value })} />
          <Stack direction="row" spacing={1}>
            <Button onClick={() => navigate(-1)}>{t("portal.cancel")}</Button>
            <Button type="submit" variant="contained" size="large" sx={{ flex: 1 }} disabled={send.isPending || !(Number(amount) > 0) || form.transactionId.trim().length < 3}>
              {t("portal.send")}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
};

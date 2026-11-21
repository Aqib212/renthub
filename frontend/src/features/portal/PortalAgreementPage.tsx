import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import toast from "react-hot-toast";
import { portalApi } from "@/api/portal";
import { useT } from "@/i18n";
import { apiError, formatBDT, formatDate, toBnDigits } from "@/utils/format";
import { AgreementDeed } from "@/features/agreements/AgreementDeed";
import { usePortalHome } from "./PortalLayout";

/** Terms, deposit ledger, the printable agreement, and the move-out request. */
export const PortalAgreementPage = () => {
  const { id } = useParams();
  const { t, lang } = useT();
  const qc = useQueryClient();
  const { data: home } = usePortalHome();
  const [picked, setPicked] = useState<number | null>(null);
  const agreementId = Number(id ?? picked ?? home?.tenancies[0]?.agreementId ?? 0);
  const tenancy = home?.tenancies.find((x) => x.agreementId === agreementId);
  const { data: a } = useQuery({ queryKey: ["portal", "agreement", agreementId], queryFn: () => portalApi.agreement(agreementId), enabled: !!agreementId });
  const [showDeed, setShowDeed] = useState(false);
  const [notice, setNotice] = useState(false);

  const withdraw = useMutation({
    mutationFn: (rid: number) => portalApi.withdrawNotice(rid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal"] }),
    onError: (e) => toast.error(apiError(e)),
  });

  if (!a) return <Typography>{t("common.loading")}</Typography>;
  const n = (x: number) => (lang === "bn" ? toBnDigits(x) : String(x));
  const months = Math.round(a.noticeDays / 30);

  if (showDeed) {
    return (
      <Box>
        <Button sx={{ mb: 1, displayPrint: "none" }} onClick={() => setShowDeed(false)}>← {t("portal.agreement")}</Button>
        <AgreementDeed a={a} building={a.building} landlordName={a.landlordName} />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {(home?.tenancies.length ?? 0) > 1 && !id && (
        <TextField select size="small" value={agreementId} onChange={(e) => setPicked(Number(e.target.value))}>
          {home!.tenancies.map((x) => <MenuItem key={x.agreementId} value={x.agreementId}>{x.unit ? `${x.unit.name}, ${x.unit.building.name}` : x.org.name}</MenuItem>)}
        </TextField>
      )}
      <Typography variant="h5" sx={{ fontSize: 22 }}>{t("portal.agreement")}</Typography>
      <Card>
        <CardContent>
          <Typography variant="h6" fontSize={16} sx={{ mb: 1 }}>{t("portal.terms")}</Typography>
          <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, m: 0, "& dt": { fontSize: 12, color: "text.secondary" }, "& dd": { m: 0, fontWeight: 600 } }}>
            <div><dt>{t("portal.rent")}</dt><dd>{formatBDT(a.currentRate, lang)}</dd></div>
            <div><dt>{t("deed.dueDay")}</dt><dd>{t("portal.dueDayValue", { day: n(a.dueDay) })}</dd></div>
            <div><dt>{t("deed.start")}</dt><dd>{formatDate(a.startDate, lang)}</dd></div>
            <div><dt>{t("deed.end")}</dt><dd>{a.endDate ? formatDate(a.endDate, lang) : t("deed.open")}</dd></div>
            <div><dt>{t("portal.noticePeriod")}</dt><dd>{t("portal.monthsValue", { months: n(months) })}</dd></div>
            <div><dt>{t("portal.deposit")}</dt><dd>{formatBDT(a.depositBalance, lang)}</dd></div>
          </Box>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setShowDeed(true)}>{t("portal.printDeed")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontSize={16} sx={{ mb: 1 }}>{t("portal.depositLedger")}</Typography>
          <Stack spacing={0.75}>
            {a.deposits.map((d: any) => (
              <Stack key={d.id} direction="row" justifyContent="space-between">
                <Typography fontSize={14}>{formatDate(d.date, lang)} · {d.note ?? d.type}</Typography>
                <Typography fontSize={14} fontWeight={600}>{d.type === "RECEIVED" ? "+" : "−"}{formatBDT(d.amount, lang)}</Typography>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {tenancy?.pendingNotice ? (
        <Alert severity="info" action={<Button size="small" onClick={() => withdraw.mutate(tenancy.pendingNotice!.id)}>{t("portal.withdraw")}</Button>}>
          {t("portal.noticePending", { date: formatDate(tenancy.pendingNotice.moveOutDate, lang) })}
        </Alert>
      ) : a.status === "ACTIVE" && (
        <Button variant="outlined" color="warning" onClick={() => setNotice(true)}>{t("portal.moveOut")}</Button>
      )}
      {notice && <NoticeDialog agreementId={agreementId} months={months} onClose={() => setNotice(false)} />}
    </Stack>
  );
};

const NoticeDialog = ({ agreementId, months, onClose }: { agreementId: number; months: number; onClose: () => void }) => {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const earliest = new Date();
  earliest.setMonth(earliest.getMonth() + months);
  const [date, setDate] = useState(earliest.toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: () => portalApi.notice({ agreementId, moveOutDate: date, reason: reason || undefined }),
    onSuccess: (r) => {
      toast.success(t("portal.noticeSent"));
      r.warnings.forEach((w) => toast(w, { icon: "⚠️" }));
      qc.invalidateQueries({ queryKey: ["portal"] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("portal.moveOutTitle")}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        <Typography fontSize={14} color="text.secondary">{t("portal.moveOutHelp", { months: lang === "bn" ? toBnDigits(months) : months })}</Typography>
        <TextField type="date" label={t("portal.moveOutDate")} value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label={t("portal.reason")} value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("portal.cancel")}</Button>
        <Button variant="contained" disabled={send.isPending || !date} onClick={() => send.mutate()}>{t("portal.send")}</Button>
      </DialogActions>
    </Dialog>
  );
};

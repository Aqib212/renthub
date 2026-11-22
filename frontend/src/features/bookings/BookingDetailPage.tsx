import { useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, Link, Stack, TextField, Typography,
} from "@mui/material";
import { Add, DeleteOutline, EditOutlined, PlayArrow, ReceiptLongOutlined } from "@mui/icons-material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { DocumentsCard } from "@/components/DocumentsCard";
import { PaymentFormDialog } from "@/features/payments/components/PaymentFormDialog";
import { bookingApi, type Booking, type Extra } from "@/api/bookings";
import { useCurrentMembership } from "@/store/authStore";
import { useT, type MessageKey } from "@/i18n";
import { apiError, formatBDT } from "@/utils/format";
import { tripCharge } from "@/utils/rental";
import { BOOKING_CHIP, BookingDialog, formatWhen, fromInput, toInput } from "./BookingsPage";

const toTrip = (b: Booking, over: { endKm?: number | null; endedAt?: string | null; extras?: Extra[] } = {}) => ({
  startAt: new Date(b.startAt), endAt: new Date(b.endAt),
  startedAt: b.startedAt ? new Date(b.startedAt) : null,
  endedAt: (over.endedAt ?? b.endedAt) ? new Date(over.endedAt ?? b.endedAt!) : null,
  dayRate: b.dayRate, hourCap: b.hourCap, kmCap: b.kmCap, overtimeRate: b.overtimeRate, extraKmRate: b.extraKmRate, fuelPerKm: b.fuelPerKm,
  startKm: b.startKm, endKm: over.endKm !== undefined ? over.endKm : b.endKm, extras: over.extras ?? b.extras ?? [],
});

export const BookingDetailPage = () => {
  const { id } = useParams();
  const { t, lang } = useT();
  const qc = useQueryClient();
  const role = useCurrentMembership()?.role;
  const canBook = role === "OWNER" || role === "MANAGER";
  const canRun = canBook || role === "CARETAKER" || role === "ACCOUNTANT";
  const { data: b } = useQuery({ queryKey: ["booking", id], queryFn: () => bookingApi.get(id!) });
  const [edit, setEdit] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startKm, setStartKm] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [charge, setCharge] = useState("");
  const [collect, setCollect] = useState(false);
  const [sheet, setSheet] = useState<{ endKm: string; endedAt: string; extras: { label: string; amount: string }[] } | null>(null);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  if (b && sheetFor !== `${b.id}:${b.status}`) {
    setSheetFor(`${b.id}:${b.status}`);
    setSheet({ endKm: b.endKm != null ? String(b.endKm) : "", endedAt: toInput(b.endedAt), extras: (b.extras ?? []).map((x) => ({ label: x.label, amount: String(x.amount) })) });
  }
  const sheetBody = () => ({
    endKm: sheet!.endKm === "" ? null : Number(sheet!.endKm),
    endedAt: sheet!.endedAt ? fromInput(sheet!.endedAt) : null,
    extras: sheet!.extras.filter((x) => x.label || Number(x.amount)).map((x) => ({ label: x.label || "Extra", amount: Number(x.amount) || 0 })),
  });
  const live = useMemo(() => (b && sheet && b.status === "ON_TRIP" ? tripCharge(toTrip(b, sheetBody())) : b?.charge), [b, sheet]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (msg: string) => (x: Booking) => {
    qc.setQueryData(["booking", id], x);
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["vehicles"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    toast.success(msg);
  };
  const err = (e: unknown) => toast.error(apiError(e));
  const start = useMutation({ mutationFn: () => bookingApi.start(b!.id, { startKm: Number(startKm), startedAt: startedAt ? fromInput(startedAt) : undefined }), onSuccess: (x) => { done(t("book.saved"))(x); setStarting(false); }, onError: err });
  const save = useMutation({ mutationFn: () => bookingApi.sheet(b!.id, sheetBody()), onSuccess: done(t("book.saved")), onError: err });
  const close = useMutation({ mutationFn: () => bookingApi.close(b!.id, sheetBody()), onSuccess: done(t("book.closed")), onError: err });
  const cancel = useMutation({ mutationFn: () => bookingApi.cancel(b!.id, charge === "" ? {} : { charge: Number(charge) }), onSuccess: (x) => { done(t("book.saved"))(x); setCancelling(false); }, onError: err });
  if (!b || !sheet) return null;

  const row = (label: string, value: React.ReactNode) => (
    <Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 0.75, borderBottom: 1, borderColor: "divider" }}>
      <Typography color="text.secondary" fontSize={14}>{label}</Typography>
      <Typography fontSize={14} fontWeight={600} textAlign="right">{value || "–"}</Typography>
    </Stack>
  );
  const open = b.status === "RESERVED" || b.status === "ON_TRIP";
  const setExtra = (i: number, k: "label" | "amount", v: string) => setSheet({ ...sheet, extras: sheet.extras.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });

  return (
    <Box>
      <PageHeader
        title={b.customer}
        subtitle={`${b.vehicle.regNo} · ${formatWhen(b.startAt, lang)} – ${formatWhen(b.endAt, lang)}`}
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {b.status === "RESERVED" && canRun && <Button variant="contained" startIcon={<PlayArrow />} onClick={() => { setStartKm(""); setStartedAt(toInput(new Date().toISOString())); setStarting(true); }}>{t("book.start")}</Button>}
            {b.status === "RESERVED" && canBook && <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEdit(true)}>{t("book.edit")}</Button>}
            {open && canBook && <Button color="error" onClick={() => { setCharge(""); setCancelling(true); }}>{t("book.cancel")}</Button>}
          </Stack>
        }
      />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" fontSize={17}>{b.vehicleLabel}</Typography>
                  <Chip size="small" label={t(`book.status.${b.status}` as MessageKey)} sx={{ bgcolor: BOOKING_CHIP[b.status].bg, color: BOOKING_CHIP[b.status].fg }} />
                </Stack>
                {row(t("book.customer"), <>{b.customer}{b.tenant.phone && <> · <a href={`tel:${b.tenant.phone}`} style={{ color: "inherit" }}>{b.tenant.phone}</a></>}</>)}
                {row(t("book.vehicle"), <Link component={RouterLink} to={`/vehicles/${b.vehicle.id}`}>{b.vehicle.regNo}{b.vehicle.model ? ` · ${b.vehicle.model}` : ""}</Link>)}
                {row(t("book.driver"), [b.driverName, b.driverPhone].filter(Boolean).join(" · "))}
                {row(t("book.pickup"), b.pickup)}
                {row(t("book.destination"), `${b.destination ?? "–"}${b.outstation ? ` (${t("book.outstation")})` : ""}`)}
                {row(t("book.terms"), `${formatBDT(b.dayRate, lang)} / ${t("veh.perDay")} · ${b.hourCap} h${b.kmCap ? ` · ${b.kmCap} km` : ""}`)}
                {b.notes && <Typography fontSize={14} color="text.secondary" sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>{b.notes}</Typography>}
              </CardContent>
            </Card>

            {b.status !== "RESERVED" && b.status !== "CANCELLED" && (
              <Card>
                <CardContent sx={{ display: "grid", gap: 2 }}>
                  <Typography variant="h6" fontSize={17}>{t("book.sheet")}</Typography>
                  <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr" }}>
                    <TextField label={t("book.startKm")} value={b.startKm ?? ""} disabled />
                    <TextField label={t("book.startedAt")} value={b.startedAt ? formatWhen(b.startedAt, lang) : ""} disabled />
                    <TextField label={t("book.endKm")} type="number" value={sheet.endKm} onChange={(e) => setSheet({ ...sheet, endKm: e.target.value })} disabled={b.status !== "ON_TRIP" || !canRun} />
                    <TextField label={t("book.endedAt")} type="datetime-local" value={sheet.endedAt} onChange={(e) => setSheet({ ...sheet, endedAt: e.target.value })} InputLabelProps={{ shrink: true }} disabled={b.status !== "ON_TRIP" || !canRun} />
                  </Box>
                  <Typography fontWeight={600} fontSize={14}>{t("book.extras")}</Typography>
                  {sheet.extras.map((x, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                      <TextField size="small" label={t("book.extraLabel")} value={x.label} onChange={(e) => setExtra(i, "label", e.target.value)} sx={{ flex: 2 }} disabled={b.status !== "ON_TRIP"} />
                      <TextField size="small" label={t("book.extraAmount")} type="number" value={x.amount} onChange={(e) => setExtra(i, "amount", e.target.value)} sx={{ flex: 1 }} disabled={b.status !== "ON_TRIP"} />
                      {b.status === "ON_TRIP" && <IconButton aria-label="Remove" onClick={() => setSheet({ ...sheet, extras: sheet.extras.filter((_, j) => j !== i) })}><DeleteOutline /></IconButton>}
                    </Stack>
                  ))}
                  {b.status === "ON_TRIP" && canRun && (
                    <>
                      <Button size="small" startIcon={<Add />} sx={{ justifySelf: "start" }} onClick={() => setSheet({ ...sheet, extras: [...sheet.extras, { label: "", amount: "" }] })}>{t("book.addExtra")}</Button>
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("book.saveSheet")}</Button>
                        <Button variant="contained" onClick={() => close.mutate()} disabled={close.isPending || sheet.endKm === ""}>{t("book.close")}</Button>
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        <Grid item xs={12} md={6}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" fontSize={17}>{b.status === "RESERVED" ? t("book.estimate") : t("book.bill")}</Typography>
                  {live && <Typography fontSize={13} color="text.secondary">{t("book.days", { n: live.days })}{live.km != null ? ` · ${t("book.km", { km: live.km })}` : ""}</Typography>}
                </Stack>
                {b.status === "CANCELLED"
                  ? row(t("book.cancelCharge"), formatBDT(b.cancelCharge ?? 0, lang))
                  : live?.items.map((i) => row(`${i.label}${i.detail ? ` (${i.detail})` : ""}`, formatBDT(i.amount, lang)))}
                {b.invoice && (
                  <>
                    {row(t("book.total"), formatBDT(b.status === "ON_TRIP" && live ? live.total : b.invoice.totalAmount, lang))}
                    {row(t("book.paid"), formatBDT(b.invoice.paidAmount, lang))}
                    {row(t("book.due"), <Typography component="span" fontWeight={700} color={b.invoice.dueAmount > 0 ? "error.main" : "success.main"}>{formatBDT(b.invoice.dueAmount, lang)}</Typography>)}
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      {canRun && b.invoice.dueAmount > 0 && <Button variant="contained" onClick={() => setCollect(true)}>{t("book.collect")}</Button>}
                      <Button startIcon={<ReceiptLongOutlined />} component={RouterLink} to={`/invoices/${b.invoice.id}/print`}>{t("book.printInvoice")}</Button>
                    </Stack>
                  </>
                )}
              </CardContent>
            </Card>
            <DocumentsCard link={{ bookingId: b.id }} />
          </Stack>
        </Grid>
      </Grid>

      <BookingDialog open={edit} onClose={() => setEdit(false)} booking={b} />
      <Dialog open={starting} onClose={() => setStarting(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("book.start")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField autoFocus label={t("book.startKm")} type="number" value={startKm} onChange={(e) => setStartKm(e.target.value)} />
            <TextField label={t("book.startedAt")} type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStarting(false)}>{t("book.cancelDialog")}</Button>
          <Button variant="contained" onClick={() => start.mutate()} disabled={startKm === "" || start.isPending}>{t("book.start")}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={cancelling} onClose={() => setCancelling(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("book.cancel")}</DialogTitle>
        <DialogContent>
          <TextField sx={{ mt: 1 }} fullWidth label={t("book.cancelCharge")} type="number" value={charge} onChange={(e) => setCharge(e.target.value)}
            placeholder={String(b.invoice?.paidAmount ?? 0)} helperText={t("book.cancelHint", { paid: formatBDT(b.invoice?.paidAmount ?? 0, lang) })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelling(false)}>{t("book.cancelDialog")}</Button>
          <Button color="error" variant="contained" onClick={() => cancel.mutate()} disabled={cancel.isPending}>{t("book.cancel")}</Button>
        </DialogActions>
      </Dialog>
      <PaymentFormDialog open={collect} onClose={() => setCollect(false)} preselectedInvoiceId={b.invoice?.id}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["booking", id] }); qc.invalidateQueries({ queryKey: ["bookings"] }); }} />
    </Box>
  );
};

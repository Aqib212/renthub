import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Autocomplete, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  IconButton, Link, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from "@mui/material";
import { Add, ChevronLeft, ChevronRight } from "@mui/icons-material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { bookingApi, type Booking, type BookingInput, type BookingStatus } from "@/api/bookings";
import { vehicleApi, type Vehicle } from "@/api/vehicles";
import { tenantApi } from "@/api/tenant";
import type { Tenant } from "@/types/tenant";
import { useCurrentMembership } from "@/store/authStore";
import { useT, type MessageKey } from "@/i18n";
import { apiError, formatBDT } from "@/utils/format";
import { tripCharge } from "@/utils/rental";
import { CHIP } from "@/theme";

export const BOOKING_CHIP: Record<BookingStatus, { bg: string; fg: string }> = { RESERVED: CHIP.info, ON_TRIP: CHIP.warning, DONE: CHIP.ok, CANCELLED: CHIP.muted };

const DAYS = 14;
const DAY = 86_400_000;
/** Local "YYYY-MM-DD" of a date (the browser runs on Bangladesh time). */
export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** ISO -> value for <input type="datetime-local"> */
export const toInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${localDay(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const fromInput = (v: string) => (v ? new Date(v).toISOString() : "");
export const formatWhen = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const addDays = (day: string, n: number) => localDay(new Date(new Date(`${day}T12:00`).getTime() + n * DAY));

const num = (s: string) => (s === "" ? undefined : Number(s));
const METHODS = ["CASH", "BKASH", "NAGAD", "ROCKET", "BANK", "CHEQUE"];

/** New booking, or edit a reserved one. `preset` comes from a click on the calendar. */
export const BookingDialog = ({ open, onClose, booking, preset }: {
  open: boolean; onClose: () => void; booking?: Booking | null; preset?: { vehicleId?: number; day?: string } | null;
}) => {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles"], queryFn: vehicleApi.list, enabled: open });
  const { data: tenants = [] } = useQuery({ queryKey: ["tenants", "all"], queryFn: async () => (await tenantApi.getAllForOwner()).data.data as Tenant[], enabled: open && !booking });
  const blank = () => {
    const day = preset?.day ?? localDay(new Date(Date.now() + DAY));
    const v = vehicles.find((x) => x.id === preset?.vehicleId);
    return {
      vehicleId: preset?.vehicleId ?? ("" as number | ""), startAt: `${day}T09:00`, endAt: `${day}T19:00`, dayRate: v?.rate ? String(v.rate) : "",
      hourCap: "10", kmCap: "", overtimeRate: "", extraKmRate: "", fuelPerKm: "0", driverName: "", driverPhone: "", pickup: "", destination: "", outstation: false, notes: "",
    };
  };
  const [f, setF] = useState(blank);
  const [who, setWho] = useState<"new" | "existing">("new");
  const [existing, setExisting] = useState<Tenant | null>(null);
  const [cust, setCust] = useState({ firstName: "", phone: "", company: false });
  const [adv, setAdv] = useState({ amount: "", method: "CASH", transactionId: "" });
  const [loaded, setLoaded] = useState<string | null>(null);
  const key = open ? `${booking?.id ?? "new"}:${preset?.vehicleId ?? ""}:${preset?.day ?? ""}` : null;
  if (key && loaded !== key) {
    setLoaded(key);
    setF(booking ? {
      vehicleId: booking.vehicleId, startAt: toInput(booking.startAt), endAt: toInput(booking.endAt), dayRate: String(booking.dayRate), hourCap: String(booking.hourCap),
      kmCap: booking.kmCap ? String(booking.kmCap) : "", overtimeRate: String(booking.overtimeRate || ""), extraKmRate: String(booking.extraKmRate || ""), fuelPerKm: String(booking.fuelPerKm),
      driverName: booking.driverName ?? "", driverPhone: booking.driverPhone ?? "", pickup: booking.pickup ?? "", destination: booking.destination ?? "", outstation: booking.outstation, notes: booking.notes ?? "",
    } : blank());
    setCust({ firstName: "", phone: "", company: false });
    setAdv({ amount: "", method: "CASH", transactionId: "" });
    setExisting(null);
  }
  if (!open && loaded) setLoaded(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const pickVehicle = (id: number) => {
    const v = vehicles.find((x) => x.id === id);
    setF({ ...f, vehicleId: id, dayRate: f.dayRate || (v?.rate ? String(v.rate) : "") });
  };
  const estimate = useMemo(() => {
    if (!f.startAt || !f.endAt || !f.dayRate) return null;
    return tripCharge({ startAt: new Date(f.startAt), endAt: new Date(f.endAt), dayRate: Number(f.dayRate), hourCap: Number(f.hourCap) || 10, kmCap: num(f.kmCap) ?? null, overtimeRate: Number(f.overtimeRate) || 0, extraKmRate: Number(f.extraKmRate) || 0, fuelPerKm: Number(f.fuelPerKm) || 0 });
  }, [f]);

  const save = useMutation({
    mutationFn: () => {
      const body: BookingInput = {
        vehicleId: Number(f.vehicleId), startAt: fromInput(f.startAt), endAt: fromInput(f.endAt), dayRate: Number(f.dayRate), hourCap: Number(f.hourCap) || 10,
        kmCap: num(f.kmCap) ?? null, overtimeRate: Number(f.overtimeRate) || 0, extraKmRate: Number(f.extraKmRate) || 0, fuelPerKm: Number(f.fuelPerKm) || 0,
        driverName: f.driverName || null, driverPhone: f.driverPhone || null, pickup: f.pickup || null, destination: f.destination || null, outstation: f.outstation, notes: f.notes || null,
      };
      if (booking) return bookingApi.update(booking.id, body);
      return bookingApi.create({
        ...body,
        ...(who === "existing" && existing ? { tenantId: existing.id } : { customer: { firstName: cust.firstName, phone: cust.phone || undefined, kind: cust.company ? "COMPANY" : "PERSON" } }),
        ...(Number(adv.amount) > 0 ? { advance: { amount: Number(adv.amount), method: adv.method, transactionId: adv.transactionId || undefined } } : {}),
      });
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking", String(b.id)] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(t("book.saved"));
      onClose();
      if (!booking) navigate(`/bookings/${b.id}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const ready = !!f.vehicleId && !!f.startAt && !!f.endAt && f.endAt > f.startAt && Number(f.dayRate) > 0 && (booking || (who === "existing" ? !!existing : !!cust.firstName));
  const grid2 = { display: "grid", gap: 2, gridTemplateColumns: { sm: "1fr 1fr" } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{booking ? t("book.edit") : t("book.new")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {!booking && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography fontWeight={600}>{t("book.customer")}</Typography>
                <ToggleButtonGroup exclusive size="small" value={who} onChange={(_, v) => v && setWho(v)} aria-label={t("book.customer")}>
                  <ToggleButton value="new">{t("book.newCustomer")}</ToggleButton>
                  <ToggleButton value="existing">{t("book.existing")}</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              {who === "existing" ? (
                <Autocomplete options={tenants} value={existing} onChange={(_, v) => setExisting(v)}
                  getOptionLabel={(x) => `${x.firstName} ${x.lastName}`.trim() + (x.phone ? ` · ${x.phone}` : "")}
                  renderInput={(p) => <TextField {...p} label={t("book.customer")} />} />
              ) : (
                <Box sx={grid2}>
                  <TextField label={t("book.name")} required value={cust.firstName} onChange={(e) => setCust({ ...cust, firstName: e.target.value })} />
                  <TextField label={t("book.phone")} value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
                  <FormControlLabel control={<Checkbox checked={cust.company} onChange={(e) => setCust({ ...cust, company: e.target.checked })} />} label={t("book.company")} />
                </Box>
              )}
            </Box>
          )}
          <Box sx={grid2}>
            <TextField select label={t("book.vehicle")} value={f.vehicleId} onChange={(e) => pickVehicle(Number(e.target.value))}>
              {vehicles.filter((v) => v.status !== "OFF_ROAD" || v.id === f.vehicleId).map((v) => <MenuItem key={v.id} value={v.id}>{v.regNo} · {v.type}{v.model ? ` · ${v.model}` : ""}</MenuItem>)}
            </TextField>
            <Box />
            <TextField label={t("book.from")} type="datetime-local" value={f.startAt} onChange={set("startAt")} InputLabelProps={{ shrink: true }} />
            <TextField label={t("book.to")} type="datetime-local" value={f.endAt} onChange={set("endAt")} InputLabelProps={{ shrink: true }} error={!!f.endAt && f.endAt <= f.startAt} />
            <TextField label={t("book.pickup")} value={f.pickup} onChange={set("pickup")} />
            <TextField label={t("book.destination")} value={f.destination} onChange={set("destination")} />
            <TextField label={t("book.driver")} value={f.driverName} onChange={set("driverName")} />
            <TextField label={t("book.driverPhone")} value={f.driverPhone} onChange={set("driverPhone")} />
            <FormControlLabel control={<Checkbox checked={f.outstation} onChange={(e) => setF({ ...f, outstation: e.target.checked })} />} label={t("book.outstation")} />
          </Box>
          <Typography fontWeight={600}>{t("book.terms")}</Typography>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" } }}>
            <TextField label={t("book.dayRate")} type="number" value={f.dayRate} onChange={set("dayRate")} />
            <TextField label={t("book.hourCap")} type="number" value={f.hourCap} onChange={set("hourCap")} />
            <TextField label={t("book.kmCap")} type="number" value={f.kmCap} onChange={set("kmCap")} helperText={t("book.kmCapHint")} />
            <TextField label={t("book.overtimeRate")} type="number" value={f.overtimeRate} onChange={set("overtimeRate")} />
            <TextField label={t("book.extraKmRate")} type="number" value={f.extraKmRate} onChange={set("extraKmRate")} />
            <TextField label={t("book.fuelPerKm")} type="number" value={f.fuelPerKm} onChange={set("fuelPerKm")} helperText={t("book.fuelHint")} />
          </Box>
          {!booking && (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" } }}>
              <TextField label={t("book.advance")} type="number" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} />
              <TextField select label={t("book.method")} value={adv.method} onChange={(e) => setAdv({ ...adv, method: e.target.value })}>
                {METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
              {adv.method !== "CASH" && <TextField label={t("book.trxId")} value={adv.transactionId} onChange={(e) => setAdv({ ...adv, transactionId: e.target.value })} />}
            </Box>
          )}
          <TextField label={t("book.notes")} value={f.notes} onChange={set("notes")} multiline minRows={2} />
          {estimate && (
            <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.5 }}>
              <Typography fontSize={13} color="text.secondary">{t("book.estimate")} · {t("book.days", { n: estimate.days })}</Typography>
              {estimate.items.map((i) => (
                <Stack key={i.label} direction="row" justifyContent="space-between"><Typography fontSize={14}>{i.label}{i.detail ? ` (${i.detail})` : ""}</Typography><Typography fontSize={14}>{formatBDT(i.amount, lang)}</Typography></Stack>
              ))}
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}><Typography fontWeight={700}>{t("book.total")}</Typography><Typography fontWeight={700}>{formatBDT(estimate.total, lang)}</Typography></Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("book.cancelDialog")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={!ready || save.isPending}>{t("book.save")}</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Calendar of the fleet: one row per vehicle, 14 days, bookings as bars, driver leases in grey. */
export const BookingsPage = () => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const role = useCurrentMembership()?.role;
  const canBook = role === "OWNER" || role === "MANAGER";
  const [from, setFrom] = useState(() => localDay(new Date()));
  const [dialog, setDialog] = useState<{ vehicleId?: number; day?: string } | null>(null);
  const to = addDays(from, DAYS - 1);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles"], queryFn: vehicleApi.list });
  const { data: bookings = [] } = useQuery({ queryKey: ["bookings", from, to], queryFn: () => bookingApi.list({ from, to }) });
  const live = bookings.filter((b) => b.status !== "CANCELLED");
  const today = localDay(new Date());

  /** grid columns (1-based, after the label column) covered by [start, end] within the window, or null */
  const idx = (day: string) => Math.round((new Date(`${day}T12:00`).getTime() - new Date(`${from}T12:00`).getTime()) / DAY);
  const span = (start: string, end: string | null) => {
    const s = Math.max(0, idx(start));
    const e = Math.min(DAYS - 1, end ? idx(end) : DAYS - 1);
    return s <= e ? { gridColumn: `${s + 2} / ${e + 3}` } : null;
  };
  const leaseSpan = (v: Vehicle) => (v.agreement ? span(v.agreement.startDate.slice(0, 10), null) : null);

  return (
    <Box>
      <PageHeader title={t("book.title")} subtitle={t("book.subtitle")}
        actions={canBook && <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({})}>{t("book.new")}</Button>} />
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton aria-label={t("book.prev")} onClick={() => setFrom(addDays(from, -7))}><ChevronLeft /></IconButton>
        <TextField type="date" size="small" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        <IconButton aria-label={t("book.next")} onClick={() => setFrom(addDays(from, 7))}><ChevronRight /></IconButton>
        {from !== today && <Button size="small" onClick={() => setFrom(today)}>{t("book.today")}</Button>}
      </Stack>

      <Card sx={{ mb: 2.5 }}>
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 160 + DAYS * 44 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: `160px repeat(${DAYS}, 1fr)`, borderBottom: 1, borderColor: "divider" }}>
              <Typography fontSize={12} color="text.secondary" sx={{ p: 1 }}>{t("book.vehicle")}</Typography>
              {days.map((d) => {
                const dt = new Date(`${d}T12:00`);
                return (
                  <Box key={d} sx={{ textAlign: "center", py: 0.75, bgcolor: d === today ? "action.selected" : undefined }}>
                    <Typography fontSize={11} color="text.secondary">{dt.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "short" })}</Typography>
                    <Typography fontSize={13} fontWeight={600}>{dt.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric" })}</Typography>
                  </Box>
                );
              })}
            </Box>
            {vehicles.map((v) => {
              const lease = leaseSpan(v);
              return (
                <Box key={v.id} sx={{ display: "grid", gridTemplateColumns: `160px repeat(${DAYS}, 1fr)`, gridTemplateRows: "44px", borderBottom: 1, borderColor: "divider" }}>
                  <Box sx={{ gridRow: 1, gridColumn: 1, px: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                    <Link component={RouterLink} to={`/vehicles/${v.id}`} fontSize={13} fontWeight={600} noWrap underline="hover">{v.regNo}</Link>
                    <Typography fontSize={11} color="text.secondary" noWrap>{v.type}{v.model ? ` · ${v.model}` : ""}</Typography>
                  </Box>
                  {days.map((d, i) => (
                    <Box key={d} onClick={canBook && !lease ? () => setDialog({ vehicleId: v.id, day: d }) : undefined}
                      sx={{ gridRow: 1, gridColumn: i + 2, borderLeft: 1, borderColor: "divider", bgcolor: d === today ? "action.hover" : undefined, cursor: canBook && !lease ? "pointer" : undefined, "&:hover": canBook && !lease ? { bgcolor: "action.selected" } : undefined }} />
                  ))}
                  {lease && (
                    <Box sx={{ ...lease, gridRow: 1, m: 0.75, borderRadius: 1, bgcolor: CHIP.muted.bg, color: CHIP.muted.fg, px: 1, display: "flex", alignItems: "center", overflow: "hidden", pointerEvents: "none" }}>
                      <Typography fontSize={12} noWrap>{t("book.leased")} · {v.agreement!.driver.name}</Typography>
                    </Box>
                  )}
                  {live.filter((b) => b.vehicleId === v.id).map((b) => {
                    const s = span(localDay(new Date(b.startedAt ?? b.startAt)), localDay(new Date(b.endedAt ?? b.endAt)));
                    if (!s) return null;
                    const c = BOOKING_CHIP[b.status];
                    return (
                      <Tooltip key={b.id} title={`${b.customer} · ${formatWhen(b.startAt, lang)} – ${formatWhen(b.endAt, lang)}${b.destination ? ` · ${b.destination}` : ""}`}>
                        <Box role="button" tabIndex={0} onClick={() => navigate(`/bookings/${b.id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/bookings/${b.id}`)}
                          sx={{ ...s, gridRow: 1, m: 0.75, borderRadius: 1, bgcolor: c.bg, color: c.fg, px: 1, display: "flex", alignItems: "center", overflow: "hidden", cursor: "pointer", zIndex: 1, border: 1, borderColor: "transparent", "&:hover, &:focus-visible": { borderColor: c.fg, outline: "none" } }}>
                          <Typography fontSize={12} fontWeight={600} noWrap>{b.customer}</Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              );
            })}
            {!vehicles.length && <Typography color="text.secondary" sx={{ p: 2 }}>{t("book.noVehicles")}</Typography>}
          </Box>
        </Box>
      </Card>

      <Typography variant="h6" fontSize={17} sx={{ mb: 1 }}>{t("book.list")}</Typography>
      <Stack spacing={1}>
        {bookings.map((b) => (
          <Card key={b.id}>
            <CardContent component={RouterLink} to={`/bookings/${b.id}`} sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", color: "inherit", textDecoration: "none", "&:last-child": { pb: 2 } }}>
              <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
                <Typography fontWeight={700} noWrap>{b.customer}</Typography>
                <Typography fontSize={13} color="text.secondary">{b.vehicle.regNo} · {formatWhen(b.startAt, lang)} – {formatWhen(b.endAt, lang)}{b.destination ? ` · ${b.destination}` : ""}</Typography>
              </Box>
              <Typography fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }}>{formatBDT(b.invoice?.totalAmount ?? b.charge.total, lang)}</Typography>
              <Chip size="small" label={t(`book.status.${b.status}` as MessageKey)} sx={{ bgcolor: BOOKING_CHIP[b.status].bg, color: BOOKING_CHIP[b.status].fg }} />
            </CardContent>
          </Card>
        ))}
        {!bookings.length && <Typography color="text.secondary">{t("book.empty")}</Typography>}
      </Stack>

      <BookingDialog open={!!dialog} onClose={() => setDialog(null)} preset={dialog} />
    </Box>
  );
};

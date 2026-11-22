import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { VEHICLE_TYPES, vehicleApi, type Vehicle, type VehicleInput, type VehicleStatus } from "@/api/vehicles";
import { DOCUMENT_KINDS } from "@/api/documents";
import { useCurrentMembership } from "@/store/authStore";
import { useT, type MessageKey } from "@/i18n";
import { apiError, formatBDT, formatDate } from "@/utils/format";
import { CHIP } from "@/theme";

export const STATUS_CHIP: Record<VehicleStatus, { bg: string; fg: string }> = { AVAILABLE: CHIP.info, ON_LEASE: CHIP.ok, OFF_ROAD: CHIP.warning };
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);

/** Add / edit a vehicle. Used by the list and the detail page. */
export const VehicleDialog = ({ open, onClose, vehicle }: { open: boolean; onClose: () => void; vehicle?: Vehicle | null }) => {
  const { t } = useT();
  const qc = useQueryClient();
  const blank: VehicleInput = { type: "CNG", regNo: "", model: "", year: null, color: "", chassisNo: "", engineNo: "", rate: null, notes: "" };
  const [form, setForm] = useState<VehicleInput>(blank);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setForm(vehicle ? { type: vehicle.type, regNo: vehicle.regNo, model: vehicle.model ?? "", year: vehicle.year, color: vehicle.color ?? "", chassisNo: vehicle.chassisNo ?? "", engineNo: vehicle.engineNo ?? "", rate: vehicle.rate, notes: vehicle.notes ?? "" } : blank);
  }
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, year: form.year || null, rate: form.rate || null };
      return vehicle ? vehicleApi.update(vehicle.id, body) : vehicleApi.create(body);
    },
    onSuccess: () => {
      toast.success(t("veh.saved"));
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["vehicle"] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const set = (k: keyof VehicleInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: k === "year" || k === "rate" ? (e.target.value ? Number(e.target.value) : null) : e.target.value });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{vehicle ? t("veh.edit") : t("veh.add")}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { sm: "1fr 1fr" }, mt: 1 }}>
          <TextField select label={t("veh.type")} value={form.type} onChange={set("type")}>
            {VEHICLE_TYPES.map((v) => <MenuItem key={v} value={v}>{t(`veh.type.${v}` as MessageKey)}</MenuItem>)}
          </TextField>
          <TextField label={t("veh.regNo")} required value={form.regNo} onChange={set("regNo")} placeholder="DHAKA METRO-THA 11-2345" />
          <TextField label={t("veh.model")} value={form.model ?? ""} onChange={set("model")} />
          <TextField label={t("veh.year")} type="number" value={form.year ?? ""} onChange={set("year")} />
          <TextField label={t("veh.color")} value={form.color ?? ""} onChange={set("color")} />
          <TextField label={t("veh.rate")} type="number" value={form.rate ?? ""} onChange={set("rate")} helperText={t("veh.rateHint")} />
          <TextField label={t("veh.chassis")} value={form.chassisNo ?? ""} onChange={set("chassisNo")} />
          <TextField label={t("veh.engine")} value={form.engineNo ?? ""} onChange={set("engineNo")} />
          <TextField label={t("veh.notes")} multiline minRows={2} value={form.notes ?? ""} onChange={set("notes")} sx={{ gridColumn: { sm: "1 / -1" } }} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("portal.cancel")}</Button>
        <Button variant="contained" disabled={form.regNo.trim().length < 3 || save.isPending} onClick={() => save.mutate()}>{t("jama.save")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export const ExpiryText = ({ expiresAt }: { expiresAt: string }) => {
  const { t, lang } = useT();
  const left = daysUntil(expiresAt);
  return (
    <Typography component="span" fontSize="inherit" color={left < 0 ? "error.main" : left <= 30 ? "warning.dark" : "text.secondary"}>
      {formatDate(expiresAt, lang)} · {left < 0 ? t("doc.expired") : t("doc.expiresIn", { days: left })}
    </Typography>
  );
};

export const VehiclesPage = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const role = useCurrentMembership()?.role;
  const canWrite = role === "OWNER" || role === "MANAGER";
  const [open, setOpen] = useState(false);
  const { data: vehicles = [], isLoading } = useQuery({ queryKey: ["vehicles"], queryFn: vehicleApi.list });

  return (
    <Box>
      <PageHeader
        title={t("veh.title")}
        subtitle={t("veh.subtitle")}
        actions={canWrite && <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>{t("veh.add")}</Button>}
      />
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("veh.regNo")}</TableCell>
                <TableCell>{t("veh.type")}</TableCell>
                <TableCell>{t("veh.driver")}</TableCell>
                <TableCell align="right">{t("veh.terms")}</TableCell>
                <TableCell>{t("veh.status")}</TableCell>
                <TableCell>{t("veh.nextExpiry")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/vehicles/${v.id}`)}>
                  <TableCell sx={{ fontWeight: 600 }}>{v.regNo}<Typography fontSize={12} color="text.secondary">{[v.model, v.year].filter(Boolean).join(" · ")}</Typography></TableCell>
                  <TableCell>{t(`veh.type.${v.type}` as MessageKey)}</TableCell>
                  <TableCell>
                    {v.agreement ? (
                      <Link component={RouterLink} to={`/agreements/${v.agreement.id}`} onClick={(e) => e.stopPropagation()}>{v.agreement.driver.name}</Link>
                    ) : <Typography fontSize={14} color="text.secondary">{t("veh.noDriver")}</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    {v.agreement ? `${formatBDT(v.agreement.rate)} / ${t(v.agreement.cycle === "DAILY" ? "veh.perDay" : "veh.perMonth")}` : v.rate ? formatBDT(v.rate) : "–"}
                  </TableCell>
                  <TableCell><Chip size="small" label={t(`veh.status.${v.status}` as MessageKey)} sx={{ bgcolor: STATUS_CHIP[v.status].bg, color: STATUS_CHIP[v.status].fg }} /></TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    {v.nextExpiry ? <>{DOCUMENT_KINDS[v.nextExpiry.kind]}: <ExpiryText expiresAt={v.nextExpiry.expiresAt} /></> : "–"}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !vehicles.length && (
                <TableRow><TableCell colSpan={6}><Typography color="text.secondary">{t("veh.empty")}</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <VehicleDialog open={open} onClose={() => setOpen(false)} />
    </Box>
  );
};

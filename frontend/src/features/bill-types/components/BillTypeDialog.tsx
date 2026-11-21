import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Typography, Box,
  FormControlLabel, Switch, IconButton, InputAdornment, Alert, Grid, ButtonBase, MenuItem,
} from "@mui/material";
import { Close, Add, ElectricBolt } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { billTypeApi } from "@/api/billType";
import { CALC_METHODS, SPLIT_RULES, type BillType, type CalcMethod, type Slabs, type SplitRule } from "@/types/billType";
import { BERC_RESIDENTIAL, calcCharge } from "@/utils/billing";
import { apiError, formatBDT } from "@/utils/format";

interface Props {
  billType: BillType | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export const BillTypeDialog = ({ billType, nextSortOrder, onClose, onSaved }: Props) => {
  const [name, setName] = useState(billType?.name ?? "");
  const [method, setMethod] = useState<CalcMethod>(billType?.calcMethod ?? "FIXED");
  const [rate, setRate] = useState(str(billType?.rate));
  const [unitLabel, setUnitLabel] = useState(billType?.unitLabel ?? "");
  const [fixedCharge, setFixedCharge] = useState(str(billType?.fixedCharge));
  const [demand, setDemand] = useState(str(billType?.demandChargePerKw));
  const [vat, setVat] = useState(str(billType?.vatPercent));
  const [slabs, setSlabs] = useState<Slabs>(billType?.slabs ?? { steps: [] });
  const [appliesToAll, setAppliesToAll] = useState(billType?.appliesToAll ?? true);
  const [split, setSplit] = useState<SplitRule>(billType?.split ?? "EQUAL");

  const save = useMutation({
    mutationFn: () => {
      const data = {
        name: name.trim(),
        calcMethod: method,
        rate: ["FIXED", "METERED", "PER_PERSON"].includes(method) ? toNum(rate) : null,
        unitLabel: ["METERED", "SLAB"].includes(method) ? unitLabel || null : null,
        fixedCharge: ["METERED", "SLAB"].includes(method) ? toNum(fixedCharge) : null,
        demandChargePerKw: method === "SLAB" ? toNum(demand) : null,
        vatPercent: method === "MANUAL" || method === "SHARED" ? null : toNum(vat),
        split: method === "SHARED" ? split : null,
        slabs: method === "SLAB" ? slabs : null,
        appliesToAll,
        ...(billType ? {} : { sortOrder: nextSortOrder }),
      };
      return billType ? billTypeApi.update(billType.id, data) : billTypeApi.create(data);
    },
    onSuccess: () => {
      toast.success(billType ? "Bill type updated" : "Bill type added");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(apiError(e, "Could not save")),
  });

  const setStep = (i: number, field: "from" | "to" | "rate", value: string) => {
    const steps = slabs.steps.map((s, j) => (j === i ? { ...s, [field]: field === "to" ? toNum(value) : Number(value) || 0 } : s));
    setSlabs({ ...slabs, steps });
  };
  const addStep = () => {
    const last = slabs.steps[slabs.steps.length - 1];
    const from = last ? (last.to ?? last.from) + 1 : 1;
    setSlabs({ ...slabs, steps: [...slabs.steps, { from, to: null, rate: 0 }] });
  };
  const loadBerc = () => {
    setSlabs(BERC_RESIDENTIAL.slabs);
    setDemand(String(BERC_RESIDENTIAL.demandChargePerKw));
    setVat(String(BERC_RESIDENTIAL.vatPercent));
    setUnitLabel("kWh");
  };

  // live example so the owner can sanity-check the setup
  const example = (() => {
    const bt = { name, calcMethod: method, rate: toNum(rate), unitLabel, slabs, fixedCharge: toNum(fixedCharge), demandChargePerKw: toNum(demand), vatPercent: toNum(vat) };
    if (method === "SLAB") return { label: "200 kWh, 1 kW load", r: calcCharge(bt, { entry: { units: 200 }, loadKw: 1 }) };
    if (method === "METERED") return { label: `30 ${unitLabel || "units"}`, r: calcCharge(bt, { entry: { units: 30 } }) };
    if (method === "PER_PERSON") return { label: "4 people", r: calcCharge(bt, { members: 4 }) };
    if (method === "FIXED") return { label: "one month", r: calcCharge(bt) };
    return null;
  })();

  const money = { InputProps: { startAdornment: <InputAdornment position="start">৳</InputAdornment> } };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{billType ? `Edit ${billType.name}` : "Add bill type"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <TextField label="Name" placeholder="e.g. Lift, Dish line, Generator" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>How is it calculated?</Typography>
            <Grid container spacing={1}>
              {CALC_METHODS.map((m) => (
                <Grid item xs={12} sm={6} key={m.value}>
                  <ButtonBase
                    onClick={() => setMethod(m.value)}
                    sx={{
                      width: "100%", textAlign: "left", display: "block", p: 1.5, borderRadius: 2, border: "1.5px solid",
                      borderColor: method === m.value ? "primary.main" : "divider",
                      bgcolor: method === m.value ? "rgba(11,93,70,0.05)" : "transparent",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{m.help}</Typography>
                  </ButtonBase>
                </Grid>
              ))}
            </Grid>
          </Box>

          {["FIXED", "METERED", "PER_PERSON"].includes(method) && (
            <Stack direction="row" spacing={2}>
              <TextField
                label={method === "FIXED" ? "Monthly amount" : method === "PER_PERSON" ? "Rate per person" : "Rate per unit"}
                type="number" value={rate} onChange={(e) => setRate(e.target.value)} {...money}
              />
              {method === "METERED" && (
                <TextField label="Unit" placeholder="m³, kWh, unit" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} />
              )}
            </Stack>
          )}

          {method === "SLAB" && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Tariff slabs</Typography>
                <Button size="small" variant="outlined" startIcon={<ElectricBolt />} onClick={loadBerc}>
                  Load BERC residential tariff
                </Button>
              </Stack>
              <Stack spacing={1}>
                {slabs.steps.map((s, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <TextField size="small" label="From" type="number" value={s.from} onChange={(e) => setStep(i, "from", e.target.value)} />
                    <TextField size="small" label="To" type="number" placeholder="and above" value={str(s.to)} onChange={(e) => setStep(i, "to", e.target.value)} />
                    <TextField size="small" label="Rate" type="number" value={s.rate} onChange={(e) => setStep(i, "rate", e.target.value)} {...money} />
                    <IconButton size="small" onClick={() => setSlabs({ ...slabs, steps: slabs.steps.filter((_, j) => j !== i) })} aria-label="Remove slab">
                      <Close fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Button size="small" startIcon={<Add />} onClick={addStep} sx={{ alignSelf: "flex-start" }}>Add slab</Button>
              </Stack>
              <FormControlLabel
                sx={{ mt: 1 }}
                control={<Switch checked={!!slabs.lifeline} onChange={(e) => setSlabs({ ...slabs, lifeline: e.target.checked ? { upTo: 50, rate: 4.63 } : null })} />}
                label="Lifeline rate (whole month at a low rate when usage is small)"
              />
              {slabs.lifeline && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <TextField size="small" label="Up to units" type="number" value={slabs.lifeline.upTo}
                    onChange={(e) => setSlabs({ ...slabs, lifeline: { ...slabs.lifeline!, upTo: Number(e.target.value) || 0 } })} />
                  <TextField size="small" label="Rate" type="number" value={slabs.lifeline.rate}
                    onChange={(e) => setSlabs({ ...slabs, lifeline: { ...slabs.lifeline!, rate: Number(e.target.value) || 0 } })} {...money} />
                </Stack>
              )}
              <TextField sx={{ mt: 2 }} label="Demand charge per kW" type="number" value={demand} onChange={(e) => setDemand(e.target.value)}
                helperText="Multiplied by each flat's sanctioned load (set on the flat)" {...money} />
            </Box>
          )}

          {(method === "METERED" || method === "SLAB") && (
            <TextField label="Meter rent / minimum charge" type="number" value={fixedCharge} onChange={(e) => setFixedCharge(e.target.value)} {...money} />
          )}

          {method === "SHARED" && (
            <TextField select label="Split the bill" value={split} onChange={(e) => setSplit(e.target.value as SplitRule)}
              helperText="Enter the building's total on the Monthly billing page; each let unit gets its share.">
              {SPLIT_RULES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
            </TextField>
          )}

          {method !== "MANUAL" && method !== "SHARED" && (
            <TextField label="VAT" type="number" value={vat} onChange={(e) => setVat(e.target.value)}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
          )}

          <FormControlLabel
            control={<Switch checked={appliesToAll} onChange={(e) => setAppliesToAll(e.target.checked)} />}
            label={appliesToAll ? "Charge all occupied flats" : "Charge only the flats I choose"}
          />

          {example?.r && (
            <Alert severity="info" icon={false}>
              Example for {example.label}: <b>{formatBDT(example.r.amount)}</b>
              <Typography variant="caption" display="block" color="text.secondary">{example.r.detail}</Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <LoadingButton variant="contained" loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>
          Save
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Autocomplete, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Grid, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { flatApi } from "@/api/flat";
import { tenantApi } from "@/api/tenant";
import { agreementApi, today } from "@/api/agreement";
import { chargeFor, monthPeriod, ruleWarnings } from "@/utils/rental";
import { apiError, formatBDT } from "@/utils/format";
import type { Flat } from "@/types/flat";
import type { Tenant } from "@/types/tenant";
import { WarningsAlert, toastWarnings } from "./WarningsAlert";

type UnitRow = Flat & { floor: { name: string; building: { name: string } } };
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

export const AgreementNewPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: units = [] } = useQuery({ queryKey: ["flats", "all"], queryFn: async () => (await flatApi.getAllForOwner()).data.data as UnitRow[] });
  const { data: tenants = [] } = useQuery({ queryKey: ["tenants", "all"], queryFn: async () => (await tenantApi.getAllForOwner()).data.data as Tenant[] });

  const [flatId, setFlatId] = useState<number | "">(params.get("flatId") ? Number(params.get("flatId")) : "");
  const [who, setWho] = useState<"new" | "existing">("new");
  const [existing, setExisting] = useState<Tenant | null>(null);
  const [person, setPerson] = useState({ firstName: "", lastName: "", phone: "", nid: "", occupation: "", members: 1 });
  const [terms, setTerms] = useState({ rate: 0, startDate: today(), endDate: "", deposit: 0, firstInvoice: true });

  const unit = units.find((u) => u.id === flatId);
  const free = units.filter((u) => u.status === "VACANT" || u.id === flatId);

  // prefill from the unit's asking terms
  useEffect(() => {
    if (unit) setTerms((t) => ({ ...t, rate: Number(unit.rent), deposit: Number(unit.advance ?? 0) + Number(unit.securityDeposit ?? 0) }));
  }, [unit?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = useMemo(() => {
    if (!terms.startDate || !terms.rate) return null;
    const s = utc(terms.startDate);
    return chargeFor({ cycle: "MONTHLY", rate: terms.rate, startDate: s, endDate: terms.endDate ? utc(terms.endDate) : null }, [], monthPeriod(s.getUTCMonth() + 1, s.getUTCFullYear()));
  }, [terms.rate, terms.startDate, terms.endDate]);
  const warnings = ruleWarnings({ rate: terms.rate, depositReceived: terms.deposit });

  const save = useMutation({
    mutationFn: (activate: boolean) =>
      agreementApi.create({
        flatId: Number(flatId),
        ...(who === "existing" && existing ? { tenantId: existing.id } : { tenant: { ...person, phone: person.phone || undefined, nid: person.nid || undefined, occupation: person.occupation || undefined } }),
        rate: terms.rate,
        startDate: terms.startDate,
        endDate: terms.endDate || undefined,
        deposit: terms.deposit || undefined,
        activate,
        firstInvoice: activate && terms.firstInvoice,
      }),
    onSuccess: (r) => {
      toast.success(r.agreement.status === "DRAFT" ? "Draft saved" : "Agreement started");
      toastWarnings(r.warnings);
      navigate(`/agreements/${r.agreement.id}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const ready = !!flatId && terms.rate > 0 && !!terms.startDate && (who === "existing" ? !!existing : !!person.firstName && !!person.lastName);
  const setP = (k: keyof typeof person) => (e: React.ChangeEvent<HTMLInputElement>) => setPerson({ ...person, [k]: k === "members" ? Number(e.target.value) : e.target.value });

  return (
    <Box>
      <PageHeader title="New agreement" subtitle="Let a unit: who, at what rent, from when, and the deposit received." />
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent sx={{ display: "grid", gap: 2 }}>
                <Typography variant="h6" fontSize={17}>1. Unit</Typography>
                <TextField select label="Vacant unit" value={flatId} onChange={(e) => setFlatId(Number(e.target.value))} helperText={!free.length ? "No vacant units: end or give notice on an agreement first." : " "}>
                  {free.map((u) => <MenuItem key={u.id} value={u.id}>{u.floor.building.name} · {u.floor.name} · {u.name} ({formatBDT(u.rent)})</MenuItem>)}
                </TextField>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ display: "grid", gap: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Typography variant="h6" fontSize={17}>2. Tenant</Typography>
                  <ToggleButtonGroup exclusive size="small" value={who} onChange={(_, v) => v && setWho(v)} aria-label="New or existing tenant">
                    <ToggleButton value="new">New person</ToggleButton>
                    <ToggleButton value="existing">Existing</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                {who === "existing" ? (
                  <Autocomplete
                    options={tenants}
                    value={existing}
                    onChange={(_, v) => setExisting(v)}
                    getOptionLabel={(t) => `${t.firstName} ${t.lastName}${t.phone ? ` · ${t.phone}` : ""}`}
                    renderInput={(p) => <TextField {...p} label="Tenant" />}
                  />
                ) : (
                  <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { sm: "1fr 1fr" } }}>
                    <TextField label="First name" required value={person.firstName} onChange={setP("firstName")} />
                    <TextField label="Last name" required value={person.lastName} onChange={setP("lastName")} />
                    <TextField label="Phone" value={person.phone} onChange={setP("phone")} />
                    <TextField label="NID" value={person.nid} onChange={setP("nid")} helperText="Needed for the police (CIMS) form" />
                    <TextField label="Occupation" value={person.occupation} onChange={setP("occupation")} />
                    <TextField label="People living there" type="number" inputProps={{ min: 1 }} value={person.members} onChange={setP("members")} helperText="Used for per-person charges" />
                  </Box>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ display: "grid", gap: 2 }}>
                <Typography variant="h6" fontSize={17}>3. Terms</Typography>
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { sm: "1fr 1fr" } }}>
                  <TextField label="Monthly rent (৳)" type="number" value={terms.rate || ""} onChange={(e) => setTerms({ ...terms, rate: Number(e.target.value) })}
                    helperText={terms.rate > 25000 ? "Above ৳25,000: rent must be paid through a bank (NBR)" : " "} />
                  <TextField label="Deposit received (৳)" type="number" value={terms.deposit || ""} onChange={(e) => setTerms({ ...terms, deposit: Number(e.target.value) })}
                    helperText="Advance + security, kept in the deposit ledger" />
                  <TextField label="Move-in date" type="date" InputLabelProps={{ shrink: true }} value={terms.startDate} onChange={(e) => setTerms({ ...terms, startDate: e.target.value })} />
                  <TextField label="End date (optional)" type="date" InputLabelProps={{ shrink: true }} value={terms.endDate} onChange={(e) => setTerms({ ...terms, endDate: e.target.value })}
                    helperText="Leave empty for an open-ended agreement" />
                </Box>
                <FormControlLabel
                  control={<Checkbox checked={terms.firstInvoice} onChange={(e) => setTerms({ ...terms, firstInvoice: e.target.checked })} />}
                  label="Create the first month's invoice now"
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ position: { lg: "sticky" }, top: { lg: 88 } }}>
            <CardContent sx={{ display: "grid", gap: 1.5 }}>
              <Typography variant="h6" fontSize={17}>Summary</Typography>
              <WarningsAlert warnings={warnings} />
              <Row label="Unit" value={unit ? `${unit.floor.building.name} · ${unit.name}` : "–"} />
              <Row label="Monthly rent" value={terms.rate ? formatBDT(terms.rate) : "–"} />
              <Row label="Deposit" value={formatBDT(terms.deposit)} />
              <Row
                label="First month"
                value={first ? `${formatBDT(first.amount)}${first.prorated ? ` (${first.days} of ${first.monthDays} days)` : ""}` : "–"}
              />
              <Typography variant="caption" color="text.secondary">Rent is due by the organisation's due day each month; notice period comes from Settings.</Typography>
              <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
                <Button variant="outlined" disabled={!ready || save.isPending} onClick={() => save.mutate(false)}>Save draft</Button>
                <Button variant="contained" disabled={!ready || save.isPending} onClick={() => save.mutate(true)} sx={{ flex: 1 }}>Start agreement</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <Stack direction="row" justifyContent="space-between" gap={2} sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 1 }}>
    <Typography color="text.secondary" fontSize={14}>{label}</Typography>
    <Typography fontWeight={600} fontSize={14} textAlign="right">{value}</Typography>
  </Stack>
);

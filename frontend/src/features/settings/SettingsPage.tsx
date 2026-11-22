import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Card, CardContent, Chip, Grid, LinearProgress, MenuItem, Stack, TextField, Typography, FormControlLabel, Switch } from "@mui/material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { orgApi, type LateFee } from "@/api/org";
import { authApi } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { apiError, formatBDT } from "@/utils/format";
import { CHIP } from "@/theme";

const clauseList = (text: string) => text.split("\n").map((s) => s.trim()).filter(Boolean);
const NO_FEE: LateFee = { enabled: false, afterDays: 5, type: "FLAT", amount: 0 };

/** Late fee: added once to a monthly rent bill N days after its due date (never to jama or trip bills). */
const LateFeeCard = ({ fee }: { fee: LateFee }) => {
  const qc = useQueryClient();
  const [f, setF] = useState(fee);
  useEffect(() => setF(fee), [fee]);
  const save = useMutation({
    mutationFn: () => orgApi.update({ settings: { lateFee: f } }),
    onSuccess: () => { toast.success("Late fee saved"); qc.invalidateQueries({ queryKey: ["org-current"] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const dirty = JSON.stringify(f) !== JSON.stringify(fee);
  const example = f.type === "PERCENT" ? `${f.amount}% of the rent` : formatBDT(f.amount);
  return (
    <Card>
      <CardContent sx={{ display: "grid", gap: 2 }}>
        <Typography variant="h6" sx={{ fontSize: 17 }}>Late fee</Typography>
        <FormControlLabel control={<Switch checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />} label="Add a late fee to unpaid rent bills" />
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <TextField label="Days after due" type="number" value={f.afterDays} inputProps={{ min: 0, max: 60 }} disabled={!f.enabled}
            onChange={(e) => setF({ ...f, afterDays: Math.min(60, Math.max(0, Number(e.target.value) || 0)) })} />
          <TextField select label="Type" value={f.type} disabled={!f.enabled} onChange={(e) => setF({ ...f, type: e.target.value as LateFee["type"] })}>
            <MenuItem value="FLAT">Fixed ৳</MenuItem>
            <MenuItem value="PERCENT">% of rent</MenuItem>
          </TextField>
          <TextField label={f.type === "PERCENT" ? "Percent" : "Amount (৳)"} type="number" value={f.amount || ""} disabled={!f.enabled}
            onChange={(e) => setF({ ...f, amount: Math.max(0, Number(e.target.value) || 0) })} />
        </Box>
        <Typography fontSize={13} color="text.secondary">
          {f.enabled && f.amount > 0
            ? `${example} is added once, ${f.afterDays} day${f.afterDays === 1 ? "" : "s"} after the due date, to a rent bill that is still unpaid. It shows as "Late fine" on the bill; set the fine to 0 on the bill to waive it.`
            : "Off. Jama and rent-a-car bills never get a late fee."}
        </Typography>
        <Box><Button variant="contained" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Save</Button></Box>
      </CardContent>
    </Card>
  );
};

/** The owner's own SSLCommerz store: tenants pay bills online by bKash, Nagad, card. The password is never shown again. */
const GatewayCard = () => {
  const qc = useQueryClient();
  const { data: g } = useQuery({ queryKey: ["gateway"], queryFn: orgApi.gateway });
  const [f, setF] = useState({ storeId: "", storePass: "", sandbox: true });
  useEffect(() => { if (g) setF({ storeId: g.storeId ?? "", storePass: "", sandbox: g.sandbox }); }, [g]);
  const done = (msg: string) => () => { toast.success(msg); qc.invalidateQueries({ queryKey: ["gateway"] }); qc.invalidateQueries({ queryKey: ["org-current"] }); };
  const save = useMutation({ mutationFn: () => orgApi.saveGateway({ storeId: f.storeId.trim(), storePass: f.storePass || undefined, sandbox: f.sandbox }), onSuccess: done("Online payments saved"), onError: (e) => toast.error(apiError(e)) });
  const remove = useMutation({ mutationFn: orgApi.removeGateway, onSuccess: done("Online payments turned off"), onError: (e) => toast.error(apiError(e)) });
  if (!g) return null;
  const chip = g.configured ? (g.sandbox ? { label: "Test mode", ...CHIP.warning } : { label: "Live", ...CHIP.ok }) : { label: "Not set up", ...CHIP.muted };
  return (
    <Card>
      <CardContent sx={{ display: "grid", gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontSize: 17 }}>Online payments</Typography>
          <Chip size="small" label={chip.label} sx={{ bgcolor: chip.bg, color: chip.fg }} />
        </Stack>
        <Typography fontSize={13} color="text.secondary">
          Tenants get a "Pay online" button on the bill link (SMS and portal) and pay by bKash, Nagad, Rocket or card through your own SSLCommerz store. The money goes to your store; the receipt is sent automatically.
        </Typography>
        <TextField label="Store ID" value={f.storeId} onChange={(e) => setF({ ...f, storeId: e.target.value })} />
        <TextField label="Store password" type="password" autoComplete="new-password" value={f.storePass} onChange={(e) => setF({ ...f, storePass: e.target.value })}
          helperText={g.configured ? "Saved and hidden. Type a new one only to change it." : "From your SSLCommerz merchant panel."} />
        <FormControlLabel control={<Switch checked={f.sandbox} onChange={(e) => setF({ ...f, sandbox: e.target.checked })} />} label="Test mode (SSLCommerz sandbox; no real money)" />
        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={!f.storeId.trim() || (!g.configured && !f.storePass) || save.isPending} onClick={() => save.mutate()}>Save</Button>
          {g.configured && <Button color="error" disabled={remove.isPending} onClick={() => window.confirm("Turn off online payments?") && remove.mutate()}>Turn off</Button>}
        </Stack>
      </CardContent>
    </Card>
  );
};

export const SettingsPage = () => {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const { data: org } = useQuery({ queryKey: ["org-current"], queryFn: orgApi.current });
  const [form, setForm] = useState({ name: "", dueDay: 10, noticeMonths: 2, clauses: "", portal: true, payInfo: "" });

  useEffect(() => {
    if (org) setForm({ name: org.name, dueDay: org.settings.dueDay, noticeMonths: org.settings.noticeMonths, clauses: (org.settings.agreementClauses ?? []).join("\n"),
      portal: org.settings.portal?.enabled !== false, payInfo: org.settings.payInfo ?? "" });
  }, [org]);

  const save = useMutation({
    mutationFn: () => orgApi.update({ name: form.name, settings: { dueDay: form.dueDay, noticeMonths: form.noticeMonths, agreementClauses: clauseList(form.clauses), portal: { enabled: form.portal }, payInfo: form.payInfo } }),
    onSuccess: async () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["org-current"] });
      // the organisation name also shows in the sidebar switcher
      const res = await authApi.getProfile();
      setUser(res.data.data);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const dirty = !!org && (form.name !== org.name || form.dueDay !== org.settings.dueDay || form.noticeMonths !== org.settings.noticeMonths
    || clauseList(form.clauses).join("\n") !== (org.settings.agreementClauses ?? []).join("\n")
    || form.portal !== (org.settings.portal?.enabled !== false) || form.payInfo !== (org.settings.payInfo ?? ""));

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Rules that apply to every building in this workspace." />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ display: "grid", gap: 2.5 }}>
              <Typography variant="h6" sx={{ fontSize: 17 }}>Organisation</Typography>
              <TextField label="Name on invoices" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { sm: "1fr 1fr" } }}>
                <TextField
                  label="Rent due by (day of month)" type="number" value={form.dueDay}
                  inputProps={{ min: 1, max: 28 }}
                  helperText="Rent is billed in advance; DNCC guidance says by the 10th."
                  onChange={(e) => setForm({ ...form, dueDay: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })}
                />
                <TextField
                  label="Notice period (months)" type="number" value={form.noticeMonths}
                  inputProps={{ min: 1, max: 6 }}
                  helperText="Either side ends a tenancy with this much notice (usually 2)."
                  onChange={(e) => setForm({ ...form, noticeMonths: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })}
                />
              </Box>
              <TextField
                label="Default extra conditions for new agreements" multiline minRows={3} value={form.clauses}
                helperText="One per line. Copied into each new agreement deed after the standard DNCC conditions; editable per agreement."
                onChange={(e) => setForm({ ...form, clauses: e.target.value })}
              />
              <Typography variant="h6" sx={{ fontSize: 17, mt: 1 }}>Tenant portal</Typography>
              <FormControlLabel
                control={<Switch checked={form.portal} onChange={(e) => setForm({ ...form, portal: e.target.checked })} />}
                label="Tenants can log in at /portal with their phone number (SMS code) to see bills, receipts and report repairs"
              />
              <TextField
                label="How tenants pay you" multiline minRows={2} value={form.payInfo}
                placeholder={"bKash (personal): 01XXXXXXXXX\nDBBL A/C 123.456.789, Hasan Properties"}
                helperText={'Shown in the portal next to "I have paid".'}
                onChange={(e) => setForm({ ...form, payInfo: e.target.value })}
              />
              <Box>
                <Button variant="contained" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Save</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Stack spacing={2.5}>
            <GatewayCard />
            {org && <LateFeeCard fee={org.settings.lateFee ?? NO_FEE} />}
            <Card>
              <CardContent sx={{ display: "grid", gap: 1.25 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" sx={{ fontSize: 17 }}>Plan</Typography>
                  {org?.planInfo && (
                    <Chip size="small" label={org.planInfo.expired ? `${org.planInfo.name} (ended)` : org.planInfo.name}
                      sx={org.planInfo.expired ? { bgcolor: CHIP.warning.bg, color: CHIP.warning.fg } : { bgcolor: CHIP.ok.bg, color: CHIP.ok.fg }} />
                  )}
                </Stack>
                {org?.planInfo && (
                  <>
                    <Typography fontSize={14}>{org.planInfo.used} of {org.planInfo.limit} units and vehicles</Typography>
                    <LinearProgress variant="determinate" value={Math.min(100, (org.planInfo.used / Math.max(1, org.planInfo.limit)) * 100)}
                      color={org.planInfo.used >= org.planInfo.limit ? "error" : "primary"} sx={{ height: 8, borderRadius: 4 }} />
                    <Typography fontSize={13} color="text.secondary">
                      {org.planInfo.paidUntil ? `${org.planInfo.expired ? "Ended" : "Paid until"} ${new Date(org.planInfo.paidUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. ` : ""}
                      SMS balance {org.smsCredits ?? 0} (sent this month: {org.smsUsedThisMonth ?? 0}). Contact RentHub to upgrade or top up.
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { HomeWork, Logout, Search, Visibility } from "@mui/icons-material";
import toast from "react-hot-toast";
import { adminApi, PLAN_LIMITS, type AdminOrg, type PlanName } from "@/api/admin";
import { authApi } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { apiError } from "@/utils/format";
import { CHIP } from "@/theme";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–");
const ymd = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString().slice(0, 10) : "");

/** Plan, limit, paid-until. */
const PlanDialog = ({ org, onClose }: { org: AdminOrg | null; onClose: () => void }) => {
  const qc = useQueryClient();
  const [f, setF] = useState({ plan: "FREE" as PlanName, unitLimit: "", paidUntil: "" });
  const [forId, setForId] = useState<number | null>(null);
  if (org && forId !== org.id) {
    setForId(org.id);
    setF({ plan: org.plan, unitLimit: org.unitLimit ? String(org.unitLimit) : "", paidUntil: ymd(org.paidUntil) });
  }
  const save = useMutation({
    mutationFn: () => adminApi.update(org!.id, { plan: f.plan, unitLimit: f.plan === "CUSTOM" ? Number(f.unitLimit) || null : null, paidUntil: f.paidUntil || null }),
    onSuccess: () => { toast.success("Plan saved"); qc.invalidateQueries({ queryKey: ["admin-orgs"] }); setForId(null); onClose(); },
    onError: (e) => toast.error(apiError(e)),
  });
  const plus = (months: number) => {
    const base = f.paidUntil && new Date(f.paidUntil) > new Date() ? new Date(f.paidUntil) : new Date();
    base.setMonth(base.getMonth() + months);
    setF({ ...f, paidUntil: base.toISOString().slice(0, 10) });
  };
  return (
    <Dialog open={!!org} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Plan · {org?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Plan" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as PlanName })}>
            {(Object.keys(PLAN_LIMITS) as PlanName[]).map((p) => <MenuItem key={p} value={p}>{p} · up to {PLAN_LIMITS[p as keyof typeof PLAN_LIMITS]} units</MenuItem>)}
            <MenuItem value="CUSTOM">CUSTOM · own limit</MenuItem>
          </TextField>
          {f.plan === "CUSTOM" && <TextField label="Units + vehicles allowed" type="number" value={f.unitLimit} onChange={(e) => setF({ ...f, unitLimit: e.target.value })} />}
          {f.plan !== "FREE" && (
            <>
              <TextField label="Paid until" type="date" value={f.paidUntil} onChange={(e) => setF({ ...f, paidUntil: e.target.value })} InputLabelProps={{ shrink: true }}
                helperText="After this day the FREE limit applies (nothing is deleted). Empty = no expiry." />
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => plus(1)}>+1 month</Button>
                <Button size="small" onClick={() => plus(6)}>+6 months</Button>
                <Button size="small" onClick={() => plus(12)}>+1 year</Button>
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || (f.plan === "CUSTOM" && !Number(f.unitLimit))}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Top up or correct the prepaid SMS balance, with the ledger. */
const CreditsDialog = ({ org, onClose }: { org: AdminOrg | null; onClose: () => void }) => {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { data: entries = [] } = useQuery({ queryKey: ["admin-credits", org?.id], queryFn: () => adminApi.credits(org!.id), enabled: !!org });
  const save = useMutation({
    mutationFn: () => adminApi.addCredits(org!.id, { amount: Number(amount), reason }),
    onSuccess: () => {
      toast.success("SMS credits updated");
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      qc.invalidateQueries({ queryKey: ["admin-credits", org?.id] });
      setAmount("");
      setReason("");
    },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <Dialog open={!!org} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>SMS credits · {org?.name}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>Balance: <b>{org?.smsCredits ?? 0}</b> SMS · used this month: {org?.smsUsedThisMonth ?? 0}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField label="Add (negative to correct)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} sx={{ width: { sm: 200 } }} />
          <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="bKash 9XK… ৳500 for 1,500 SMS" fullWidth />
        </Stack>
        <Typography fontWeight={600} sx={{ mt: 2.5, mb: 0.5 }}>History</Typography>
        {!entries.length && <Typography color="text.secondary" fontSize={14}>No top-ups yet.</Typography>}
        {entries.map((e) => (
          <Stack key={e.id} direction="row" justifyContent="space-between" sx={{ py: 0.5, borderBottom: 1, borderColor: "divider" }}>
            <Typography fontSize={14}>{e.reason}</Typography>
            <Typography fontSize={14} sx={{ whiteSpace: "nowrap", ml: 2 }} color={e.delta < 0 ? "error.main" : "success.main"}>{e.delta > 0 ? "+" : ""}{e.delta} · {day(e.createdAt)}</Typography>
          </Stack>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !Number(amount) || reason.trim().length < 2}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Platform console: every workspace, its plan and SMS, suspend, and a read-only "open as owner". */
export const AdminPage = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, logout, startSupport } = useAuthStore();
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<AdminOrg | null>(null);
  const [credits, setCredits] = useState<AdminOrg | null>(null);
  const { data: orgs = [], isLoading } = useQuery({ queryKey: ["admin-orgs", search], queryFn: () => adminApi.orgs(search) });
  const { data: balance } = useQuery({ queryKey: ["admin-sms-balance"], queryFn: adminApi.smsBalance });
  const suspend = useMutation({
    mutationFn: (o: AdminOrg) => adminApi.update(o.id, { suspended: !o.suspendedAt }),
    onSuccess: (o) => { toast.success(o?.suspendedAt ? "Workspace suspended" : "Workspace reactivated"); qc.invalidateQueries({ queryKey: ["admin-orgs"] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const open = useMutation({
    mutationFn: (o: AdminOrg) => adminApi.support(o.id),
    onSuccess: (s) => { startSupport({ orgId: s.orgId, orgName: s.orgName, accessToken: s.accessToken }); qc.clear(); navigate("/dashboard"); },
    onError: (e) => toast.error(apiError(e)),
  });
  const signOut = async () => {
    await authApi.logout().catch(() => {});
    logout();
    navigate("/login");
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, md: 3.5 }, py: 1.5, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
        <HomeWork color="primary" />
        <Typography fontWeight={700} sx={{ flexGrow: 1 }}>RentHub admin</Typography>
        <Typography fontSize={13} color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>{user?.email}</Typography>
        <Tooltip title="Log out"><IconButton aria-label="Log out" onClick={signOut}><Logout /></IconButton></Tooltip>
      </Stack>
      <Box sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1440, mx: "auto" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2.5 }}>
          <Card sx={{ flex: 1 }}><CardContent>
            <Typography fontSize={13} color="text.secondary">Workspaces</Typography>
            <Typography fontSize={26} fontWeight={700}>{orgs.length}</Typography>
          </CardContent></Card>
          <Card sx={{ flex: 1 }}><CardContent>
            <Typography fontSize={13} color="text.secondary">SMS sent this month</Typography>
            <Typography fontSize={26} fontWeight={700}>{orgs.reduce((s, o) => s + o.smsUsedThisMonth, 0).toLocaleString("en-IN")}</Typography>
          </CardContent></Card>
          <Card sx={{ flex: 1 }}><CardContent>
            <Typography fontSize={13} color="text.secondary">SMS gateway ({balance?.driver ?? "…"})</Typography>
            <Typography fontSize={26} fontWeight={700} color={balance?.error ? "error.main" : undefined}>
              {balance?.balance != null ? `৳${balance.balance.toLocaleString("en-IN")}` : balance?.error ? "Error" : "–"}
            </Typography>
            {balance?.error && <Typography fontSize={12} color="error.main">{balance.error}</Typography>}
          </CardContent></Card>
        </Stack>

        <TextField size="small" placeholder="Search name, owner email or phone" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, width: { xs: "100%", sm: 360 } }}
          InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }} />
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Workspace</TableCell><TableCell>Plan</TableCell><TableCell sx={{ minWidth: 150 }}>Units + vehicles</TableCell>
                  <TableCell>SMS</TableCell><TableCell>Open bills</TableCell><TableCell>Owner last login</TableCell><TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>}
                {orgs.map((o) => {
                  const pct = Math.min(100, (o.used / Math.max(1, o.limit)) * 100);
                  const chip = o.suspendedAt ? { label: "Suspended", ...CHIP.error } : o.expired ? { label: `${o.plan} expired`, ...CHIP.warning } : { label: o.plan, ...(o.plan === "FREE" ? CHIP.muted : CHIP.ok) };
                  return (
                    <TableRow key={o.id} hover sx={{ opacity: o.suspendedAt ? 0.6 : 1 }}>
                      <TableCell>
                        <Typography fontWeight={600} fontSize={14}>{o.name}</Typography>
                        <Typography fontSize={12} color="text.secondary">{o.owner ? `${o.owner.firstName} ${o.owner.lastName} · ${o.owner.email}${o.owner.phone ? ` · ${o.owner.phone}` : ""}` : "No owner"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={chip.label} sx={{ bgcolor: chip.bg, color: chip.fg, cursor: "pointer" }} onClick={() => setPlan(o)} />
                        <Typography fontSize={12} color="text.secondary">{o.plan === "FREE" ? "no expiry" : `until ${day(o.paidUntil)}`}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontSize={13}>{o.used} / {o.limit} <Typography component="span" fontSize={12} color="text.secondary">({o.units} units, {o.vehicles} vehicles)</Typography></Typography>
                        <LinearProgress variant="determinate" value={pct} color={pct >= 100 ? "error" : pct >= 80 ? "warning" : "primary"} sx={{ height: 6, borderRadius: 3, mt: 0.5 }} />
                      </TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => setCredits(o)} color={o.smsCredits < 50 ? "error" : "primary"} sx={{ minWidth: 0, px: 0.5 }}>{o.smsCredits.toLocaleString("en-IN")} left</Button>
                        <Typography fontSize={12} color="text.secondary">{o.smsUsedThisMonth} this month</Typography>
                      </TableCell>
                      <TableCell>{o.openInvoices}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", fontSize: 13 }}>{day(o.owner?.lastLoginAt ?? null)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Button size="small" onClick={() => setPlan(o)}>Plan</Button>
                        <Button size="small" color={o.suspendedAt ? "primary" : "error"} disabled={suspend.isPending}
                          onClick={() => (o.suspendedAt || window.confirm(`Suspend ${o.name}? Staff and tenants can't log in until you reactivate it.`)) && suspend.mutate(o)}>
                          {o.suspendedAt ? "Reactivate" : "Suspend"}
                        </Button>
                        <Tooltip title="Open as owner (read-only, 30 min, shown in their Activity log)">
                          <span><IconButton aria-label={`Open ${o.name} as owner`} disabled={open.isPending || !o.owner} onClick={() => open.mutate(o)}><Visibility /></IconButton></span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && !orgs.length && <TableRow><TableCell colSpan={7}><Typography color="text.secondary">No workspaces.</Typography></TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
      <PlanDialog org={plan} onClose={() => setPlan(null)} />
      <CreditsDialog org={credits ? orgs.find((o) => o.id === credits.id) ?? credits : null} onClose={() => setCredits(null)} />
    </Box>
  );
};

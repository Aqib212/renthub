import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Link, MenuItem, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { agreementApi, AGREEMENT_STATUS, DEPOSIT_LABEL, fmtDate, today, type DepositType, type WithWarnings } from "@/api/agreement";
import { INVOICE_STATUS } from "@/theme";
import { apiError, formatBDT } from "@/utils/format";
import { WarningsAlert, toastWarnings } from "./WarningsAlert";

type DialogKind = "revision" | "deposit" | "notice" | null;

export const AgreementDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: a, isLoading } = useQuery({ queryKey: ["agreement", id], queryFn: () => agreementApi.get(id!) });
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const done = (msg: string) => (r: WithWarnings) => {
    toast.success(msg);
    setWarnings(r.warnings);
    toastWarnings(r.warnings);
    qc.setQueryData(["agreement", id], r.agreement);
    qc.invalidateQueries({ queryKey: ["agreements"] });
    qc.invalidateQueries({ queryKey: ["flats"] });
    setDialog(null);
  };
  const activate = useMutation({ mutationFn: () => agreementApi.activate(a!.id), onSuccess: done("Agreement started"), onError: (e) => toast.error(apiError(e)) });
  const removeDraft = useMutation({
    mutationFn: () => agreementApi.remove(a!.id),
    onSuccess: () => { toast.success("Draft deleted"); navigate("/agreements"); },
    onError: (e) => toast.error(apiError(e)),
  });

  if (isLoading || !a) return <Typography>Loading…</Typography>;
  const live = a.status === "ACTIVE" || a.status === "NOTICE";

  let running = 0;
  const ledger = a.deposits.map((d) => {
    running += d.type === "RECEIVED" ? Number(d.amount) : -Number(d.amount);
    return { ...d, balance: running };
  });

  return (
    <Box>
      <PageHeader
        title={`${a.tenant.firstName} ${a.tenant.lastName}`}
        subtitle={<>
          {a.unit ? `${a.unit.building.name} · ${a.unit.floorName} · ${a.unit.name}` : "–"} · since {fmtDate(a.startDate)}{" "}
          <Chip size="small" color={AGREEMENT_STATUS[a.status].color} label={AGREEMENT_STATUS[a.status].label} sx={{ ml: 1 }} />
        </>}
        actions={<>
          <Button variant="outlined" component={RouterLink} to={`/tenants/${a.tenant.id}`}>Tenant profile</Button>
          {a.status === "DRAFT" && <>
            <Button color="error" onClick={() => removeDraft.mutate()}>Delete draft</Button>
            <Button variant="contained" onClick={() => activate.mutate()} disabled={activate.isPending}>Start agreement</Button>
          </>}
          {a.status === "ACTIVE" && <Button variant="outlined" onClick={() => setDialog("notice")}>Give notice</Button>}
          {live && <Button variant="contained" onClick={() => navigate(`/agreements/${a.id}/move-out`)}>Move out</Button>}
        </>}
      />
      <WarningsAlert warnings={warnings} />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" fontSize={17} sx={{ mb: 1.5 }}>Terms</Typography>
              <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, m: 0, "& dt": { fontSize: 12, color: "text.secondary" }, "& dd": { m: 0, fontWeight: 600 } }}>
                <div><dt>Rent now</dt><dd>{formatBDT(a.currentRate)}</dd></div>
                <div><dt>Started at</dt><dd>{formatBDT(a.rate)}</dd></div>
                <div><dt>Due by</dt><dd>Day {a.dueDay} of the month</dd></div>
                <div><dt>Notice</dt><dd>{Math.round(a.noticeDays / 30)} months</dd></div>
                <div><dt>Ends</dt><dd>{a.endDate ? fmtDate(a.endDate) : "Open-ended"}</dd></div>
                <div><dt>Notice given</dt><dd>{fmtDate(a.noticeDate)}</dd></div>
                <div><dt>Payment</dt><dd>{a.bankOnly ? "Through a bank (NBR)" : "Any method"}</dd></div>
                <div><dt>Deposit held</dt><dd>{formatBDT(a.depositBalance)}</dd></div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" fontSize={17}>Rent revisions</Typography>
                {a.status !== "ENDED" && <Button size="small" onClick={() => setDialog("revision")}>Add revision</Button>}
              </Stack>
              <Table size="small">
                <TableHead><TableRow><TableCell>From</TableCell><TableCell align="right">Rent</TableCell><TableCell>Reason</TableCell></TableRow></TableHead>
                <TableBody>
                  <TableRow><TableCell>{fmtDate(a.startDate)}</TableCell><TableCell align="right">{formatBDT(a.rate)}</TableCell><TableCell>Agreement start</TableCell></TableRow>
                  {a.revisions.map((r) => (
                    <TableRow key={r.id}><TableCell>{fmtDate(r.effectiveFrom)}</TableCell><TableCell align="right">{formatBDT(r.rate)}</TableCell><TableCell>{r.reason ?? ""}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="caption" color="text.secondary">DNCC guidance: one increase every 2 years, in June–July.</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" fontSize={17}>Deposit ledger</Typography>
                {a.status !== "ENDED" && <Button size="small" onClick={() => setDialog("deposit")}>Record entry</Button>}
              </Stack>
              <Table size="small">
                <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Entry</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Balance</TableCell></TableRow></TableHead>
                <TableBody>
                  {!ledger.length && <TableRow><TableCell colSpan={4}><Typography color="text.secondary" fontSize={14}>No deposit recorded.</Typography></TableCell></TableRow>}
                  {ledger.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmtDate(d.date)}</TableCell>
                      <TableCell>{DEPOSIT_LABEL[d.type]}{d.note ? <Typography variant="body2" color="text.secondary">{d.note}</Typography> : null}</TableCell>
                      <TableCell align="right">{d.type === "RECEIVED" ? "" : "− "}{formatBDT(d.amount)}</TableCell>
                      <TableCell align="right">{formatBDT(d.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontSize={17} sx={{ mb: 1 }}>Invoices</Typography>
              <Table size="small">
                <TableHead><TableRow><TableCell>Month</TableCell><TableCell align="right">Total</TableCell><TableCell align="right">Due</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {!a.invoices.length && <TableRow><TableCell colSpan={4}><Typography color="text.secondary" fontSize={14}>No invoices yet.</Typography></TableCell></TableRow>}
                  {a.invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell><Link component={RouterLink} to={`/invoices/${i.id}/print`}>{String(i.month).padStart(2, "0")}/{i.year}</Link></TableCell>
                      <TableCell align="right">{formatBDT(i.totalAmount)}</TableCell>
                      <TableCell align="right">{i.carriedForward ? "carried" : formatBDT(i.dueAmount)}</TableCell>
                      <TableCell><Chip size="small" color={INVOICE_STATUS[i.status]?.color ?? "default"} label={INVOICE_STATUS[i.status]?.label ?? i.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <RevisionDialog open={dialog === "revision"} onClose={() => setDialog(null)} onSave={(b) => agreementApi.addRevision(a.id, b).then(done("Revision added"))} currentRate={Number(a.currentRate)} />
      <DepositDialog open={dialog === "deposit"} onClose={() => setDialog(null)} onSave={(b) => agreementApi.addDeposit(a.id, b).then(done("Deposit entry saved"))} />
      <NoticeDialog open={dialog === "notice"} onClose={() => setDialog(null)} noticeDays={a.noticeDays} onSave={(b) => agreementApi.giveNotice(a.id, b).then(done("Notice recorded"))} />
    </Box>
  );
};

/** Small dialog wrapper: runs `save`, shows API errors as a toast, keeps the dialog open on failure. */
function useSave(save: () => Promise<unknown>) {
  return useMutation({ mutationFn: save, onError: (e) => toast.error(apiError(e)) });
}

const RevisionDialog = ({ open, onClose, onSave, currentRate }: { open: boolean; onClose: () => void; currentRate: number; onSave: (b: { effectiveFrom: string; rate: number; reason?: string }) => Promise<unknown> }) => {
  const [f, setF] = useState({ effectiveFrom: "", rate: 0, reason: "" });
  const m = useSave(() => onSave({ effectiveFrom: f.effectiveFrom, rate: f.rate, reason: f.reason || undefined }));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rent revision</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        <Typography variant="body2" color="text.secondary">Current rent {formatBDT(currentRate)}.</Typography>
        <TextField label="New rent (৳)" type="number" value={f.rate || ""} onChange={(e) => setF({ ...f, rate: Number(e.target.value) })} />
        <TextField label="Takes effect from" type="date" InputLabelProps={{ shrink: true }} value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} />
        <TextField label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!f.rate || !f.effectiveFrom || m.isPending} onClick={() => m.mutate()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

const DepositDialog = ({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (b: { type: DepositType; amount: number; date: string; note?: string }) => Promise<unknown> }) => {
  const [f, setF] = useState({ type: "RECEIVED" as DepositType, amount: 0, date: today(), note: "" });
  const m = useSave(() => onSave({ ...f, note: f.note || undefined }));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Deposit entry</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        <TextField select label="Entry" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as DepositType })}>
          {(Object.keys(DEPOSIT_LABEL) as DepositType[]).map((t) => <MenuItem key={t} value={t}>{DEPOSIT_LABEL[t]}</MenuItem>)}
        </TextField>
        <TextField label="Amount (৳)" type="number" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
        <TextField label="Date" type="date" InputLabelProps={{ shrink: true }} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <TextField label="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!f.amount || m.isPending} onClick={() => m.mutate()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

const NoticeDialog = ({ open, onClose, onSave, noticeDays }: { open: boolean; onClose: () => void; noticeDays: number; onSave: (b: { noticeDate: string; endDate?: string }) => Promise<unknown> }) => {
  const [f, setF] = useState({ noticeDate: today(), endDate: "" });
  const m = useSave(() => onSave({ noticeDate: f.noticeDate, endDate: f.endDate || undefined }));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Give notice</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        <Typography variant="body2" color="text.secondary">Either side ends the tenancy with {Math.round(noticeDays / 30)} months' notice. Leave the end date empty to use that.</Typography>
        <TextField label="Notice given on" type="date" InputLabelProps={{ shrink: true }} value={f.noticeDate} onChange={(e) => setF({ ...f, noticeDate: e.target.value })} />
        <TextField label="Last day (optional)" type="date" InputLabelProps={{ shrink: true }} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!f.noticeDate || m.isPending} onClick={() => m.mutate()}>Record notice</Button>
      </DialogActions>
    </Dialog>
  );
};

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TextField, Typography, Stack,
  Chip, Button, Alert, Skeleton, Tooltip, Grid, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import { SaveOutlined, ReceiptLongOutlined, ChevronLeft, ChevronRight, TuneOutlined } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { billTypeApi } from "@/api/billType";
import { invoiceApi } from "@/api/invoice";
import { PageHeader } from "@/components/ui/PageHeader";
import { calcCharge, type ChargeResult } from "@/utils/billing";
import { formatBDT, apiError } from "@/utils/format";
import { MONTH_NAMES } from "@/types/invoice";
import type { BillType, BillingRow, BillingCharge, EntryValues } from "@/types/billType";
import { INVOICE_STATUS } from "@/theme";

type Draft = Pick<EntryValues, "previousReading" | "currentReading" | "amount">;
const key = (flatId: number, billTypeId: number) => `${flatId}:${billTypeId}`;
const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
const now = new Date();

export const MonthlyBillingPage = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [result, setResult] = useState<{ generated: number; total: number; missing: { flatName: string; billType: string }[] } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["billing-month", month, year],
    queryFn: () => billTypeApi.getMonth(month, year),
  });

  useEffect(() => setDrafts({}), [month, year]);

  const shiftMonth = (d: number) => {
    const m = month + d;
    setMonth(((m + 11) % 12) + 1);
    setYear(year + Math.floor((m - 1) / 12));
  };

  const draftFor = (row: BillingRow, c: BillingCharge): Draft => {
    const d = drafts[key(row.flatId, c.billTypeId)];
    if (d) return d;
    return {
      previousReading: c.entry?.previousReading ?? c.lastReading,
      currentReading: c.entry?.currentReading ?? null,
      amount: c.entry?.amount ?? null,
    };
  };

  const compute = (bt: BillType, row: BillingRow, c: BillingCharge): ChargeResult | null => {
    if (!c.applies) return null;
    const d = draftFor(row, c);
    return calcCharge(bt, {
      override: c.override,
      members: row.members,
      loadKw: row.sanctionedLoad,
      entry: d,
    });
  };

  const setDraft = (row: BillingRow, c: BillingCharge, change: Partial<Draft>) =>
    setDrafts((ds) => ({ ...ds, [key(row.flatId, c.billTypeId)]: { ...draftFor(row, c), ...change } }));

  const totals = useMemo(() => {
    if (!data) return { rows: new Map<number, number>(), grand: 0, pending: 0, needed: 0 };
    const rows = new Map<number, number>();
    let pending = 0;
    let needed = 0;
    for (const row of data.rows) {
      let t = row.rent;
      row.charges.forEach((c, i) => {
        const bt = data.billTypes[i];
        const r = compute(bt, row, c);
        if (r) t += r.amount;
        if (c.applies && ["METERED", "SLAB", "MANUAL"].includes(bt.calcMethod)) {
          needed++;
          if (!r) pending++;
        }
      });
      rows.set(row.flatId, t);
    }
    return { rows, grand: [...rows.values()].reduce((a, b) => a + b, 0), pending, needed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, drafts]);

  const dirty = Object.keys(drafts).length > 0;

  const save = useMutation({
    mutationFn: () =>
      billTypeApi.saveMonth(month, year, Object.entries(drafts).map(([k, d]) => {
        const [flatId, billTypeId] = k.split(":").map(Number);
        return { flatId, billTypeId, ...d };
      })),
    onSuccess: (fresh) => {
      qc.setQueryData(["billing-month", month, year], fresh);
      setDrafts({});
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (dirty) await save.mutateAsync();
      return invoiceApi.generate(month, year);
    },
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["billing-month"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(apiError(e, "Could not generate invoices")),
  });

  const billTypes = data?.billTypes ?? [];
  const uninvoiced = data?.rows.filter((r) => !r.invoice).length ?? 0;

  return (
    <Box>
      <PageHeader
        title="Monthly Billing"
        subtitle={`Rent for ${MONTH_NAMES[month - 1]} is billed in advance; meter readings here are ${MONTH_NAMES[(month + 10) % 12]}'s usage. Invoices are due on the 10th.`}
        actions={
          <>
            <Button variant="outlined" startIcon={<TuneOutlined />} onClick={() => navigate("/bill-types")}>Bill types</Button>
            <LoadingButton
              variant="outlined" startIcon={<SaveOutlined />} disabled={!dirty} loading={save.isPending}
              onClick={() => save.mutate(undefined, { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(apiError(e)) })}
            >
              Save
            </LoadingButton>
            <LoadingButton variant="contained" startIcon={<ReceiptLongOutlined />} loading={generate.isPending}
              disabled={!uninvoiced} onClick={() => generate.mutate()}>
              Generate invoices{uninvoiced ? ` (${uninvoiced})` : ""}
            </LoadingButton>
          </>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Button onClick={() => shiftMonth(-1)} sx={{ minWidth: 0 }} aria-label="Previous month"><ChevronLeft /></Button>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary">Rent month</Typography>
                <Typography variant="h6">{MONTH_NAMES[month - 1]} {year}</Typography>
              </Box>
              <Button onClick={() => shiftMonth(1)} sx={{ minWidth: 0 }} aria-label="Next month"><ChevronRight /></Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4} md={2.66}>
          <Stat label="Flats to bill" value={data?.rows.length ?? "–"} />
        </Grid>
        <Grid item xs={4} md={2.66}>
          <Stat label="Entries missing" value={data ? totals.pending : "–"} tone={totals.pending ? "warning.main" : "success.main"}
            hint={data ? `${totals.needed - totals.pending} of ${totals.needed} entered` : undefined} />
        </Grid>
        <Grid item xs={4} md={2.66}>
          <Stat label="Expected this month" value={data ? formatBDT(totals.grand) : "–"} />
        </Grid>
      </Grid>

      {dirty && <Alert severity="info" sx={{ mb: 2 }}>You have unsaved changes. They are saved automatically when you generate invoices.</Alert>}

      {isLoading ? (
        <Skeleton variant="rounded" height={320} />
      ) : !data?.rows.length ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6">No occupied flats</Typography>
          <Typography color="text.secondary">Add a tenant to a flat and it will appear here for billing.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ maxHeight: "calc(100vh - 330px)" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: "sticky", left: 0, zIndex: 3, minWidth: 190 }}>Flat / Tenant</TableCell>
                <TableCell align="right">Rent</TableCell>
                {billTypes.map((bt) => (
                  <TableCell key={bt.id} sx={{ minWidth: ["METERED", "SLAB"].includes(bt.calcMethod) ? 190 : 130 }}>
                    {bt.name}
                    {bt.unitLabel && ["METERED", "SLAB"].includes(bt.calcMethod) && (
                      <Typography component="span" variant="caption" sx={{ textTransform: "none", ml: 0.5 }}>({bt.unitLabel})</Typography>
                    )}
                  </TableCell>
                ))}
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((row) => {
                const locked = !!row.invoice;
                return (
                  <TableRow key={row.flatId} hover sx={{ verticalAlign: "top" }}>
                    <TableCell sx={{ position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.flatName}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{row.buildingName}</Typography>
                      <Typography variant="caption" display="block">{row.tenantName ?? "No tenant"}</Typography>
                      {row.invoice && (
                        <Chip
                          size="small" sx={{ mt: 0.5, cursor: "pointer" }}
                          color={INVOICE_STATUS[row.invoice.status]?.color}
                          label={`Invoiced · ${INVOICE_STATUS[row.invoice.status]?.label}`}
                          onClick={() => navigate(`/invoices/${row.invoice!.id}/print`)}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">{formatBDT(row.rent)}</TableCell>
                    {row.charges.map((c, i) => {
                      const bt = billTypes[i];
                      if (!c.applies) return <TableCell key={c.billTypeId}><Typography color="text.disabled">—</Typography></TableCell>;
                      const d = draftFor(row, c);
                      const r = compute(bt, row, c);
                      const metered = bt.calcMethod === "METERED" || bt.calcMethod === "SLAB";
                      return (
                        <TableCell key={c.billTypeId}>
                          {metered && (
                            <Stack direction="row" spacing={0.75}>
                              <TextField
                                size="small" type="number" label="Previous" disabled={locked}
                                value={d.previousReading ?? ""} sx={{ width: 90 }}
                                onChange={(e) => setDraft(row, c, { previousReading: toNum(e.target.value) })}
                              />
                              <TextField
                                size="small" type="number" label="Current" disabled={locked}
                                value={d.currentReading ?? ""} sx={{ width: 90 }}
                                error={d.currentReading !== null && d.previousReading !== null && d.currentReading < d.previousReading}
                                onChange={(e) => setDraft(row, c, { currentReading: toNum(e.target.value) })}
                              />
                            </Stack>
                          )}
                          {bt.calcMethod === "MANUAL" && (
                            <TextField
                              size="small" type="number" label="Amount" disabled={locked} sx={{ width: 120 }}
                              value={d.amount ?? ""} onChange={(e) => setDraft(row, c, { amount: toNum(e.target.value) })}
                            />
                          )}
                          <Tooltip title={r?.detail ?? ""} placement="bottom-start">
                            <Typography variant="body2" sx={{ mt: metered || bt.calcMethod === "MANUAL" ? 0.5 : 0, fontWeight: 600, color: r ? "text.primary" : "warning.main" }}>
                              {r ? formatBDT(r.amount) : metered ? "Reading needed" : "Not entered"}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                    <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {formatBDT(row.invoice ? row.invoice.totalAmount : totals.rows.get(row.flatId))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!result} onClose={() => setResult(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Invoices created</DialogTitle>
        <DialogContent>
          <Typography>
            Created <b>{result?.generated}</b> invoice(s) for {MONTH_NAMES[month - 1]} {year}.
          </Typography>
          {!!result?.missing.length && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              These charges were left off because nothing was entered:
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {result.missing.map((m, i) => <li key={i}>{m.flatName}: {m.billType}</li>)}
              </ul>
              You can add them later by editing the invoice.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResult(null)}>Close</Button>
          <Button variant="contained" onClick={() => navigate(`/invoices?month=${month}&year=${year}`)}>View invoices</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const Stat = ({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ color: tone }}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </CardContent>
  </Card>
);
